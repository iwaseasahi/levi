import { z } from "zod";
import type { ScriptureLanguage } from "./scripture/search";

export type FolderSummary = {
  id: string;
  name: string;
  isPinned: boolean;
  position: number;
  lastUsedAt: string | null;
};

export type ScriptureBookmarkView = {
  id: string;
  folderId: string;
  position: number;
  title: string;
  search: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    language: ScriptureLanguage;
  };
};

export type SavedContentErrorCode =
  | "INVALID_SAVED_CONTENT_INPUT"
  | "SAVED_CONTENT_NOT_FOUND"
  | "SAVED_CONTENT_CONFLICT"
  | "SAVED_CONTENT_CATALOG_ERROR";

export class SavedContentError extends Error {
  constructor(readonly code: SavedContentErrorCode) {
    super(code);
    this.name = "SavedContentError";
  }
}

const nonblankName = z.string().trim().min(1).max(200);
const orderedIds = z
  .array(z.uuid())
  .max(1000)
  .refine((ids) => new Set(ids).size === ids.length);
const locationNumber = z.number().int().min(0).max(32767);

const createFolderSchema = z.object({ name: nonblankName }).strict();
const updateFolderSchema = z
  .object({ name: nonblankName.optional(), isPinned: z.boolean().optional() })
  .strict()
  .refine((value) => value.name !== undefined || value.isPinned !== undefined);
const reorderSchema = z.object({ ids: orderedIds }).strict();
const createBookmarkSchema = z
  .object({
    title: nonblankName,
    book: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{0,15}$/),
    chapter: locationNumber.min(1),
    startVerse: locationNumber,
    endVerse: locationNumber,
    language: z.enum(["ja", "en", "both"]),
  })
  .strict()
  .refine((value) => value.endVerse >= value.startVerse);
const updateBookmarkSchema = z.object({ title: nonblankName }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
  return result.data;
}

export const parseCreateFolder = (value: unknown) =>
  parse(createFolderSchema, value);
export const parseUpdateFolder = (value: unknown) =>
  parse(updateFolderSchema, value);
export const parseReorder = (value: unknown) => parse(reorderSchema, value);
export const parseCreateBookmark = (value: unknown) =>
  parse(createBookmarkSchema, value);
export const parseUpdateBookmark = (value: unknown) =>
  parse(updateBookmarkSchema, value);

const idSchema = z.uuid();
const folderIdSchema = z.object({ folderId: idSchema }).strict();
const bookmarkIdSchema = z.object({ bookmarkId: idSchema }).strict();

export function parseSavedContentId(value: unknown) {
  return parse(idSchema, value);
}

export type SavedContentCommand =
  | { action: "create-folder"; input: ReturnType<typeof parseCreateFolder> }
  | {
      action: "update-folder";
      folderId: string;
      input: ReturnType<typeof parseUpdateFolder>;
    }
  | { action: "reorder-folders"; ids: string[] }
  | { action: "delete-folder"; folderId: string }
  | {
      action: "create-bookmark";
      folderId: string;
      input: ReturnType<typeof parseCreateBookmark>;
    }
  | { action: "open-bookmark"; bookmarkId: string }
  | {
      action: "update-bookmark";
      bookmarkId: string;
      input: ReturnType<typeof parseUpdateBookmark>;
    }
  | { action: "reorder-bookmarks"; folderId: string; ids: string[] }
  | { action: "delete-bookmark"; bookmarkId: string };

export function parseSavedContentCommand(value: unknown): SavedContentCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
  const command = value as Record<string, unknown>;
  const payload = Object.fromEntries(
    Object.entries(command).filter(([key]) => key !== "action"),
  );
  switch (command.action) {
    case "create-folder":
      return { action: command.action, input: parseCreateFolder(payload) };
    case "update-folder": {
      const { folderId, ...input } = payload;
      return {
        action: command.action,
        folderId: parseSavedContentId(folderId),
        input: parseUpdateFolder(input),
      };
    }
    case "reorder-folders":
      return { action: command.action, ...parseReorder(payload) };
    case "delete-folder":
      return {
        action: command.action,
        ...parse(folderIdSchema, payload),
      };
    case "create-bookmark": {
      const { folderId, ...input } = payload;
      return {
        action: command.action,
        folderId: parseSavedContentId(folderId),
        input: parseCreateBookmark(input),
      };
    }
    case "open-bookmark":
    case "delete-bookmark":
      return {
        action: command.action,
        ...parse(bookmarkIdSchema, payload),
      };
    case "update-bookmark": {
      const { bookmarkId, ...input } = payload;
      return {
        action: command.action,
        bookmarkId: parseSavedContentId(bookmarkId),
        input: parseUpdateBookmark(input),
      };
    }
    case "reorder-bookmarks": {
      const { folderId, ...input } = payload;
      return {
        action: command.action,
        folderId: parseSavedContentId(folderId),
        ...parseReorder(input),
      };
    }
    default:
      throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
  }
}

export function languageFromTranslationCodes(
  primary: string,
  secondary: string | null,
): ScriptureLanguage {
  if (primary === "JSS3" && secondary === null) return "ja";
  if (primary === "NKJV" && secondary === null) return "en";
  if (primary === "JSS3" && secondary === "NKJV") return "both";
  throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
}
