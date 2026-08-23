export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

function errorCode(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined;
  const error = Reflect.get(value, "error");
  if (typeof error !== "object" || error === null) return undefined;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ClientApiError(fallbackMessage, response.status);
  }
  if (!response.ok)
    throw new ClientApiError(fallbackMessage, response.status, errorCode(body));
  return body as T;
}

export async function requestJson<T>(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
) {
  return parseJsonResponse<T>(await fetcher(input, init), fallbackMessage);
}

export function postJson<T>(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  body: object,
  fallbackMessage: string,
) {
  return requestJson<T>(
    fetcher,
    input,
    {
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    fallbackMessage,
  );
}
