import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptureSearch } from "./scripture-search";

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
const audiencePostMessage = vi.fn();
const audienceTarget = {
  closed: false,
  postMessage: audiencePostMessage,
} as unknown as Window;

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
  beforeEach(() => {
    audiencePostMessage.mockReset();
    Object.assign(audienceTarget, { closed: false });
    vi.spyOn(window, "open").mockReturnValue(audienceTarget);
  });
  afterEach(() => vi.restoreAllMocks());

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

  it("keeps the search page and opens the audience directly in the projector tab", async () => {
    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await chooseRange(user);

    const end = screen.getByLabelText("終了節（省略可）");
    expect(end).toHaveValue("17");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(window.open).toHaveBeenCalledWith(
      "/church/audience?book=JHN&chapter=3&endVerse=17&language=both&startVerse=16",
      "projector",
    );
    expect(screen.queryByText("検索結果")).not.toBeInTheDocument();
    expect(screen.queryByText("架空の日本語 16")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "投影を開始" }),
    ).not.toBeInTheDocument();
  });

  it("controls font size and previous or next scripture after the audience is ready", async () => {
    renderSearch(successfulFetcher());
    const user = userEvent.setup();
    await chooseRange(user);

    const larger = screen.getByRole("button", { name: "文字を大きく" });
    const smaller = screen.getByRole("button", { name: "文字を小さく" });
    const previous = screen.getByRole("button", { name: "前の御言葉へ" });
    const next = screen.getByRole("button", { name: "次の御言葉へ" });
    expect(larger).toBeDisabled();
    expect(smaller).toBeDisabled();
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Open" }));
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            schema: "levi.direct-audience",
            type: "READY",
            version: 1,
          },
          origin: window.location.origin,
          source: audienceTarget,
        }),
      ),
    );
    await waitFor(() => expect(larger).toBeEnabled());

    await user.click(larger);
    await user.click(smaller);
    await user.click(previous);
    await user.click(next);
    expect(audiencePostMessage.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({ action: "font-larger", type: "CONTROL" }),
      expect.objectContaining({ action: "font-smaller", type: "CONTROL" }),
      expect.objectContaining({ action: "previous", type: "CONTROL" }),
      expect.objectContaining({ action: "next", type: "CONTROL" }),
    ]);
    expect(
      audiencePostMessage.mock.calls.every(
        ([, origin]) => origin === window.location.origin,
      ),
    ).toBe(true);
  });

  it("ignores readiness from another window", async () => {
    renderSearch(successfulFetcher());
    const user = userEvent.setup();
    await chooseRange(user);
    await user.click(screen.getByRole("button", { name: "Open" }));

    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            schema: "levi.direct-audience",
            type: "READY",
            version: 1,
          },
          origin: window.location.origin,
          source: {} as Window,
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeDisabled();
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

    expect(window.open).toHaveBeenCalledWith(
      "/church/audience?book=JHN&chapter=3&endVerse=18&language=both&startVerse=16",
      "projector",
    );
  });

  it("announces and focuses the first missing required field", async () => {
    renderSearch(successfulFetcher());
    const user = userEvent.setup();
    const book = await screen.findByRole("radio", {
      name: "架空ヨハネ/Synthetic John",
    });
    await user.click(screen.getByRole("button", { name: "Open" }));
    let alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("書巻を選択してください。");

    await user.click(book);
    await waitFor(() => expect(screen.getByLabelText("章")).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Open" }));
    alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("章を入力してください。");

    await user.type(screen.getByLabelText("章"), "3");
    await waitFor(() => expect(screen.getByLabelText("開始節")).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Open" }));
    alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("開始節を入力してください。");
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

  it("announces when Chrome blocks the audience tab", async () => {
    vi.mocked(window.open).mockReturnValue(null);
    renderSearch(successfulFetcher());
    const user = userEvent.setup();
    await chooseRange(user);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chromeで新しいタブを許可してください");
    expect(alert).toHaveFocus();
  });

  it("shows a recoverable catalog server error", async () => {
    const catalogFailure = vi.fn<typeof fetch>(() => response({}, 500));
    const { unmount } = renderSearch(catalogFailure);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "検索候補を読み込めません",
    );
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeVisible();
    unmount();
  });
});
