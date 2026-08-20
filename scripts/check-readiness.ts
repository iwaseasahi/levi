const readinessUrl =
  process.env.READINESS_URL ?? "http://127.0.0.1:3000/api/ready";

export {};

const response = await fetch(readinessUrl, {
  cache: "no-store",
  signal: AbortSignal.timeout(5_000),
});
const payload = (await response.json()) as {
  checks?: { database?: string };
  status?: string;
};
const requestId = response.headers.get("x-request-id");

if (
  !response.ok ||
  payload.status !== "ready" ||
  payload.checks?.database !== "ok" ||
  !requestId
) {
  throw new Error(
    `Readiness failed: HTTP ${response.status}, status=${payload.status ?? "missing"}, requestId=${requestId ?? "missing"}`,
  );
}

process.stdout.write(`Levi is ready (requestId=${requestId}).\n`);
