import { expect, test } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";
import { E2E_FOREIGN_FOLDER_ID } from "./operator-fixture";

const E2E_GUESSED_FOLDER_ID = "00000000-0000-4000-8000-000000004399";

test("returns the same not-found response for foreign and guessed folders", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);

  const foreignFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_FOREIGN_FOLDER_ID}`,
  );
  const guessedFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_GUESSED_FOLDER_ID}`,
  );
  expect(foreignFolder.status()).toBe(404);
  expect(guessedFolder.status()).toBe(404);
  expect(await foreignFolder.text()).toBe(await guessedFolder.text());
});
