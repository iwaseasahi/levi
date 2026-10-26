import assert from "node:assert/strict";

// New releases require an upstream tag/commit review before entering this list.
export const reviewedActionPins = {
  "pnpm/setup": {
    "v2.1.0": "703c52620218391530e48b9e8870d5c0082e1b9b",
    "v3.1.1": "a0881977cd8ea73b1ed212236c99ca10dcc80cf4",
  },
  "docker/setup-buildx-action": {
    "v4.3.0": "37fe631027851001ddb9b187196cc803df7f5f0e",
    "v4.4.1": "f87e5991a6d7451dcb8d9637bfbc97413f497069",
  },
  "docker/build-push-action": {
    "v7.3.0": "53b7df96c91f9c12dcc8a07bcb9ccacbed38856a",
    "v7.4.0": "c3c9e263c25d99ce0380d002d59b67737d91b0dc",
  },
} as const;

export function assertReviewedActionUses(
  workflow: string,
  action: keyof typeof reviewedActionPins,
  expectedCount: number,
): void {
  assert(Number.isInteger(expectedCount) && expectedCount > 0);
  const uses = [
    ...workflow.matchAll(
      /^[ \t]*(?:-[ \t]*)?uses:[ \t]+([^ \t\r\n]+)(?:[ \t]+#[ \t]*(v[^ \t\r\n]+))?[ \t]*$/gm,
    ),
  ].filter((match) => match[1]?.startsWith(`${action}@`));
  assert.equal(uses.length, expectedCount, `${action}: unexpected step count`);
  assert.equal(
    new Set(uses.map((match) => match[1])).size,
    1,
    `${action}: all jobs must use the same reviewed pin`,
  );
  for (const [, reference, version] of uses) {
    assert(
      Object.entries(reviewedActionPins[action]).some(
        ([release, sha]) =>
          /^[a-f0-9]{40}$/.test(sha) &&
          reference === `${action}@${sha}` &&
          version === release,
      ),
      `${action}: unreviewed SHA or mismatched release comment`,
    );
  }
}
