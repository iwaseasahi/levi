import { describe, expect, it } from "vitest";
import { disposableRehearsalDatabaseUrl } from "./rehearsal-database-guard";

const local = "postgresql://levi:levi@127.0.0.1:55432/levi?schema=public";

describe("Bible rehearsal database guard", () => {
  it("resolves only an explicit disposable local database", () => {
    expect(disposableRehearsalDatabaseUrl(local, "levi_bible_rehearsal")).toBe(
      "postgresql://levi:levi@127.0.0.1:55432/levi_bible_rehearsal?schema=public",
    );
  });

  it("allows the isolated CI PostgreSQL service port", () => {
    expect(
      disposableRehearsalDatabaseUrl(
        "postgresql://levi:levi@localhost:5432/levi_test",
        "levi_bible_rehearsal",
      ),
    ).toBe(
      "postgresql://levi:levi@localhost:5432/levi_bible_rehearsal?schema=public",
    );
  });

  it.each([
    ["postgresql://levi:levi@db.example.com:5432/levi", "levi_bible_rehearsal"],
    ["postgresql://levi:levi@127.0.0.1:55433/levi", "levi_bible_rehearsal"],
    [local, "production"],
    [local, "levi_bible_rehearsal; DROP DATABASE levi"],
  ])("rejects an unsafe base or database", (baseUrl, database) => {
    expect(() => disposableRehearsalDatabaseUrl(baseUrl, database)).toThrow(
      "REHEARSAL_DATABASE_GUARD_REJECTED",
    );
  });
});
