import type { ChurchAccess } from "@/application/auth/church-access";
import {
  EmailChangeAuthorizationError,
  EmailChangeConflictError,
  EmailChangeFailedError,
  EmailChangeInputError,
  EmailChangeRateLimitError,
} from "@/application/auth/email-change";
import { noStoreJson } from "@/app/api/church-api-support";

const MAX_BODY_BYTES = 4_096;

interface EmailChangeService {
  requestChange(input: {
    confirmation: unknown;
    currentPassword: unknown;
    newEmail: unknown;
    userId: string;
  }): Promise<void>;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  const length = request.headers.get("content-length");
  if (
    contentType !== "application/json" ||
    !request.body ||
    (length !== null &&
      (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES))
  ) {
    throw new EmailChangeInputError();
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new EmailChangeInputError();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null || Array.isArray(body))
      throw new EmailChangeInputError();
    return body as Record<string, unknown>;
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new EmailChangeInputError();
  } finally {
    reader.releaseLock();
  }
}

export function createEmailChangeHandler(dependencies: {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  origin: string;
  service: EmailChangeService;
}) {
  return async function POST(request: Request) {
    try {
      const access = await dependencies.getChurchAccess(request.headers);
      if (access.status === "unauthenticated")
        return noStoreJson({ error: { code: "UNAUTHENTICATED" } }, 401);
      if (access.status !== "authorized" || access.mustChangePassword)
        return noStoreJson({ error: { code: "FORBIDDEN" } }, 403);
      if (
        request.headers.get("origin") !== dependencies.origin ||
        new URL(request.url).searchParams.size > 0
      ) {
        return noStoreJson({ error: { code: "FORBIDDEN" } }, 403);
      }

      const body = await readJson(request);
      await dependencies.service.requestChange({
        confirmation: body.confirmation,
        currentPassword: body.currentPassword,
        newEmail: body.newEmail,
        userId: access.userId,
      });
      return noStoreJson({ status: "verification-sent" }, 202);
    } catch (error) {
      if (error instanceof EmailChangeInputError)
        return noStoreJson({ error: { code: "INVALID_INPUT" } }, 400);
      if (error instanceof EmailChangeRateLimitError)
        return noStoreJson({ error: { code: "RATE_LIMITED" } }, 429);
      if (
        error instanceof EmailChangeAuthorizationError ||
        error instanceof EmailChangeConflictError
      ) {
        return noStoreJson({ error: { code: "CHANGE_REJECTED" } }, 409);
      }
      if (error instanceof EmailChangeFailedError)
        return noStoreJson({ error: { code: "EMAIL_UNAVAILABLE" } }, 503);
      return noStoreJson({ error: { code: "EMAIL_UNAVAILABLE" } }, 500);
    }
  };
}
