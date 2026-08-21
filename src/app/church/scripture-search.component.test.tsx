import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScriptureSearch } from "./scripture-search";

const books = [{ code: "JHN", name: "架空ヨハネ" }];
const items = [16, 17].map((verse) => ({
  location: { book: "JHN", chapter: 3, verse },
  texts: {
    english: {
      bookName: "Synthetic John",
      text: `Synthetic English ${verse}`,
      translation: "NKJV" as const,
    },
    japanese: {
      bookName: "架空ヨハネ",
      text: `架空の日本語 ${verse}`,
      translation: "JSS3" as const,
    },
  },
}));

function response(body: unknown, status = 200) {
  return Promise.resolve(Response.json(body, { status }));
}

function successfulFetcher() {
  return vi.fn<typeof fetch>((input) => {
    const url = new URL(String(input), "https://levi.example");
    if (url.pathname.endsWith("/saved-content"))
      return response({ folders: [], orderIds: [] });
    if (url.pathname.endsWith("/catalog")) {
      const book = url.searchParams.get("book");
      const chapter = url.searchParams.get("chapter");
      return response({
        books,
        chapters: book ? [3, 4] : [],
        verses: chapter ? [15, 16, 17, 18, 20] : [],
      });
    }
    return response({
      items,
      search: {
        book: "JHN",
        chapter: 3,
        startVerse: 16,
        endVerse: 17,
        language: "both",
      },
    });
  });
}

const savedContentFetcher = vi.fn<typeof fetch>(() =>
  response({ folders: [], orderIds: [] }),
);

function renderSearch(fetcher: typeof fetch) {
  return render(
    <ScriptureSearch
      fetcher={fetcher}
      savedContentFetcher={savedContentFetcher}
    />,
  );
}

async function chooseRange(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "架空ヨハネ" });
  await user.selectOptions(screen.getByLabelText("書巻"), "JHN");
  await screen.findByRole("option", { name: "3章" });
  await user.selectOptions(screen.getByLabelText("章"), "3");
  await screen.findByRole("option", { name: "16節" });
  await user.selectOptions(screen.getByLabelText("開始節"), "16");
  await user.selectOptions(screen.getByLabelText("終了節"), "17");
}

describe("ScriptureSearch", () => {
  it("supports keyboard navigation and has no detectable accessibility violations", async () => {
    const { container } = renderSearch(successfulFetcher());
    await screen.findByRole("option", { name: "架空ヨハネ" });
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByLabelText("表示言語")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("書巻")).toHaveFocus();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("cascades valid candidates, prevents a reversed range, and renders results", async () => {
    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await chooseRange(user);

    const end = screen.getByLabelText("終了節");
    expect(within(end).queryByRole("option", { name: "15節" })).toBeNull();
    expect(within(end).queryByRole("option", { name: "20節" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "御言葉を検索" }));

    const heading = await screen.findByRole("heading", { name: "検索結果" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("架空の日本語 16")).toBeVisible();
    expect(screen.getByText("Synthetic English 16")).toBeVisible();
    expect(screen.getAllByText("新改訳聖書第3版（JSS3）")).toHaveLength(2);
    const projection = screen.getByRole("link", { name: "投影を開始" });
    expect(projection).toHaveAttribute(
      "href",
      "/church/projection?book=JHN&chapter=3&startVerse=16&endVerse=17&language=both",
    );
    expect(projection.getAttribute("href")).not.toContain("架空の日本語");
  });

  it("announces and focuses validation feedback", async () => {
    renderSearch(successfulFetcher());
    await screen.findByRole("option", { name: "架空ヨハネ" });
    await userEvent.click(screen.getByRole("button", { name: "御言葉を検索" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("すべて選択してください");
  });

  it("disables controls and announces loading", async () => {
    let finish: ((value: Response) => void) | undefined;
    const fetcher = successfulFetcher();
    fetcher.mockImplementationOnce(() =>
      response({ books, chapters: [], verses: [] }),
    );
    renderSearch(fetcher);
    const user = userEvent.setup();
    await chooseRange(user);
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole("button", { name: "御言葉を検索" }));
    expect(screen.getByRole("button", { name: "検索中…" })).toBeDisabled();
    expect(screen.getByText("御言葉を検索しています。")).toBeVisible();
    finish?.(Response.json({ items: [], search: {} }));
    expect(
      await screen.findByText("該当する御言葉はありません。"),
    ).toBeVisible();
  });

  it("shows recoverable catalog and search server errors", async () => {
    const catalogFailure = vi.fn<typeof fetch>(() => response({}, 500));
    const { unmount } = renderSearch(catalogFailure);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "検索候補を読み込めません",
    );
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeVisible();
    unmount();

    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await chooseRange(user);
    fetcher.mockImplementationOnce(() =>
      response({ error: { code: "SEARCH_UNAVAILABLE" } }, 500),
    );
    await user.click(screen.getByRole("button", { name: "御言葉を検索" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "御言葉を読み込めませんでした",
    );
  });
});
