import { randomUUID } from "node:crypto";

export function buildSystemSetting() {
  const id = randomUUID();

  return {
    id,
    key: `test.${id}`,
    value: "fixture-value",
  } as const;
}
