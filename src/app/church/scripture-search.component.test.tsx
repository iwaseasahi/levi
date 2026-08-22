import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptureSearch } from "./scripture-search";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const books = [
  {
    code: "JHN",
    englishName: "Synthetic John",
    japaneseName: "架空ヨハネ",
    name: "架空ヨハネ",
  },
];
const items = [16, 17, 18].map((verse) => ({
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
    const startVerse = Number(url.searchParams.get("startVerse") ?? 16);
    const endVerse = Number(url.searchParams.get("endVerse") ?? 17);
    return response({
      items: items.filter(
        ({ location }) =>
          location.verse >= startVerse && location.verse <= endVerse,
      ),
      search: {
        book: "JHN",
        chapter: 3,
        startVerse,
        endVerse,
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
  await user.click(
    await screen.findByRole("radio", {
      name: "架空ヨハネ/Synthetic John",
    }),
  );
  await waitFor(() => expect(screen.getByLabelText("章")).toBeEnabled());
  await user.type(screen.getByLabelText("章"), "3");
  await waitFor(() => expect(screen.getByLabelText("開始節")).toBeEnabled());
  await user.type(screen.getByLabelText("開始節"), "16");
  await user.type(screen.getByLabelText("終了節（省略可）"), "17");
}

describe("ScriptureSearch", () => {
  beforeEach(() => push.mockReset());

  it("renders 66 canonically ordered bilingual book radio buttons", async () => {
    const catalogBooks = Array.from({ length: 66 }, (_, index) => ({
      code: `BOOK_${index + 1}`,
      englishName: `English ${index + 1}`,
      japaneseName: `架空書巻${index + 1}`,
      name: `架空書巻${index + 1}`,
    }));
    const fetcher = vi.fn<typeof fetch>((input) =>
      String(input).includes("/saved-content")
        ? response({ folders: [], orderIds: [] })
        : response({ books: catalogBooks, chapters: [], verses: [] }),
    );
    renderSearch(fetcher);

    const bookRadios = await screen.findAllByRole("radio", {
      name: /架空書巻\d+\/English \d+/,
    });
    expect(bookRadios).toHaveLength(66);
    expect(bookRadios[0]).toHaveAccessibleName("架空書巻1/English 1");
    expect(bookRadios[65]).toHaveAccessibleName("架空書巻66/English 66");
    const firstRow = screen.getByRole("table").querySelector("tr");
    expect(firstRow).toHaveTextContent("架空書巻1/English 1");
    expect(firstRow).toHaveTextContent("架空書巻23/English 23");
    expect(firstRow).toHaveTextContent("架空書巻45/English 45");
  });

  it("supports keyboard navigation and has no detectable accessibility violations", async () => {
    const { container } = renderSearch(successfulFetcher());
    const book = await screen.findByRole("radio", {
      name: "架空ヨハネ/Synthetic John",
    });
    book.focus();
    expect(book).toHaveFocus();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("cascades valid candidates and opens the projection controller directly", async () => {
    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await chooseRange(user);

    const end = screen.getByLabelText("終了節（省略可）");
    expect(end).toHaveValue("17");
    await user.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/church/projection?book=JHN&chapter=3&endVerse=17&language=both&startVerse=16",
      ),
    );
    expect(screen.queryByText("検索結果")).not.toBeInTheDocument();
    expect(screen.queryByText("架空の日本語 16")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "投影を開始" }),
    ).not.toBeInTheDocument();
  });

  it("normalizes an omitted end verse to the contiguous chapter end", async () => {
    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("radio", {
        name: "架空ヨハネ/Synthetic John",
      }),
    );
    await waitFor(() => expect(screen.getByLabelText("章")).toBeEnabled());
    await user.type(screen.getByLabelText("章"), "3");
    await waitFor(() => expect(screen.getByLabelText("開始節")).toBeEnabled());
    await user.type(screen.getByLabelText("開始節"), "16");
    await user.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    const searchCall = fetcher.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/api/scripture/search?"));
    expect(searchCall).toContain("startVerse=16");
    expect(searchCall).toContain("endVerse=18");
    expect(push).toHaveBeenCalledWith(
      "/church/projection?book=JHN&chapter=3&endVerse=18&language=both&startVerse=16",
    );
  });

  it("announces and focuses validation feedback", async () => {
    renderSearch(successfulFetcher());
    await screen.findByRole("radio", {
      name: "架空ヨハネ/Synthetic John",
    });
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("書巻、章、開始節をすべて入力してください");
  });

  it("resets selections and feedback", async () => {
    renderSearch(successfulFetcher());
    const user = userEvent.setup();
    await chooseRange(user);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByRole("radio", { name: "架空ヨハネ/Synthetic John" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("章")).toHaveValue("");
    expect(screen.getByLabelText("開始節")).toHaveValue("");
    expect(screen.getByLabelText("終了節（省略可）")).toHaveValue("");
    expect(screen.queryByText("検索結果")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Open" }));
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
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "御言葉を読み込めませんでした",
    );
  });
});
