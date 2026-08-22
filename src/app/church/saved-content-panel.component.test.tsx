import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import { SavedContentPanel } from "./saved-content-panel";

const folderId = "00000000-0000-4000-8000-000000000101";
const secondFolderId = "00000000-0000-4000-8000-000000000102";
const bookmarkId = "00000000-0000-4000-8000-000000000201";
const search = {
  book: "GEN",
  chapter: 1,
  startVerse: 1,
  endVerse: 2,
  language: "both" as const,
};

function folder(id: string, name: string, position: number): FolderSummary {
  return { id, name, position, isPinned: false, lastUsedAt: null };
}

function statefulFetcher() {
  let folders = [
    folder(folderId, "主日礼拝", 0),
    folder(secondFolderId, "祈祷会", 1),
  ];
  let bookmarks: ScriptureBookmarkView[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), "https://levi.example");
    if (init?.method !== "POST") {
      const selectedId = url.searchParams.get("folderId");
      if (selectedId) {
        const selected = folders.find(({ id }) => id === selectedId)!;
        return Response.json({ folder: selected, bookmarks });
      }
      return Response.json({ folders, orderIds: folders.map(({ id }) => id) });
    }
    const command = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (command.action === "create-bookmark") {
      bookmarks = [
        {
          id: bookmarkId,
          folderId,
          position: 0,
          title: String(command.title),
          search,
        },
      ];
      return Response.json({ bookmark: bookmarks[0] });
    }
    if (command.action === "open-bookmark")
      return Response.json({ bookmark: bookmarks[0] });
    if (command.action === "update-folder") {
      folders = folders.map((item) =>
        item.id === command.folderId
          ? {
              ...item,
              name: String(command.name ?? item.name),
              isPinned:
                command.isPinned === undefined
                  ? item.isPinned
                  : Boolean(command.isPinned),
            }
          : item,
      );
      return Response.json({
        folder: folders.find(({ id }) => id === command.folderId),
      });
    }
    if (command.action === "reorder-folders") {
      const ids = command.ids as string[];
      folders = ids.map((id, position) => ({
        ...folders.find((item) => item.id === id)!,
        position,
      }));
      return Response.json({ ok: true });
    }
    if (command.action === "delete-bookmark") {
      bookmarks = [];
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });
  return fetcher;
}

describe("SavedContentPanel", () => {
  it("saves and reopens a scripture bookmark accessibly", async () => {
    const fetcher = statefulFetcher();
    const onOpen = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={onOpen}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    await user.type(screen.getByLabelText("ブックマーク名"), "創世記 1:1–2");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );

    const bookmark = await screen.findByRole("button", {
      name: "創世記 1:1–2",
    });
    await user.click(bookmark);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(search));
    expect(
      await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      }),
    ).toMatchObject({ violations: [] });
  });

  it("renames, pins, reorders, and physically deletes with confirmation", async () => {
    const fetcher = statefulFetcher();
    render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    await user.clear(screen.getByLabelText("フォルダー名"));
    await user.type(screen.getByLabelText("フォルダー名"), "礼拝用");
    await user.click(screen.getByRole("button", { name: "名前を変更" }));
    expect(await screen.findByRole("button", { name: "礼拝用" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "よく使うフォルダーに固定" }),
    );
    expect(
      await screen.findByRole("button", { name: "固定：礼拝用" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "礼拝用を下へ" }));
    const list = screen.getByRole("list", { name: "フォルダー" });
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent(
      "礼拝用",
    );

    await user.type(screen.getByLabelText("ブックマーク名"), "削除対象");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(
      await screen.findByRole("button", { name: "削除対象を削除" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "削除対象" })).toBeNull(),
    );
  });

  it("shows an empty state and focuses failures", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ folders: [], orderIds: [] }));
    const { unmount } = render(
      <SavedContentPanel
        currentSearch={null}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("フォルダーはまだありません。"),
    ).toBeVisible();
    unmount();

    render(
      <SavedContentPanel
        currentSearch={null}
        fetcher={vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))}
        onOpen={vi.fn()}
      />,
    );
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
