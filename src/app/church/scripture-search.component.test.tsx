import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptureSearch } from "./scripture-search";
import { useScriptureCatalog } from "./use-scripture-catalog";

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

function renderSearch(
  fetcher: typeof fetch,
  contentFetcher: typeof fetch = savedContentFetcher,
) {
  return render(
    <ScriptureSearch fetcher={fetcher} savedContentFetcher={contentFetcher} />,
  );
}

function statefulSavedContentFetcher() {
  const folder = {
    id: "00000000-0000-4000-8000-000000000101",
    isPinned: false,
    lastUsedAt: null,
    name: "主日礼拝",
    position: 0,
  };
  let bookmarks: unknown[] = [];
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), "https://levi.example");
    if (init?.method !== "POST") {
      if (url.searchParams.has("folderId"))
        return Response.json({ bookmarks, folder });
      return Response.json({ folders: [folder], orderIds: [folder.id] });
    }
    const command = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (command.action === "create-bookmark") {
      const bookmark = {
        folderId: folder.id,
        id: "00000000-0000-4000-8000-000000000201",
        position: 0,
        search: {
          book: command.book,
          chapter: command.chapter,
          endVerse: command.endVerse,
          language: command.language,
          startVerse: command.startVerse,
        },
        title: command.title,
      };
      bookmarks = [bookmark];
      return Response.json({ bookmark });
    }
    return Response.json({ ok: true });
  });
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
    expect(screen.getByText("章(chapter)")).toBeVisible();
    expect(screen.getAllByText("節(verse)")).toHaveLength(2);
    expect(screen.getByLabelText("章")).toHaveAccessibleName("章");
    expect(screen.getByLabelText("開始節")).toHaveAccessibleName("開始節");
    expect(screen.getByLabelText("終了節（省略可）")).toHaveAccessibleName(
      "終了節（省略可）",
    );
  });

  it("normalizes full-width chapter and verse input without requesting an invalid catalog", async () => {
    const fetcher = successfulFetcher();
    renderSearch(fetcher);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("radio", {
        name: "架空ヨハネ/Synthetic John",
      }),
    );

    const chapter = screen.getByLabelText("章");
    await user.type(chapter, "３");
    await waitFor(() => expect(chapter).toHaveValue("3"));
    const startVerse = screen.getByLabelText("開始節");
    await waitFor(() => expect(startVerse).toBeEnabled());
    await user.type(startVerse, "１６");
    await user.type(screen.getByLabelText("終了節（省略可）"), "１７");

    expect(startVerse).toHaveValue("16");
    expect(screen.getByLabelText("終了節（省略可）")).toHaveValue("17");
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).includes("book=JHN&chapter=3"),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.some(([input]) => /[０-９]/.test(String(input))),
    ).toBe(false);

    const callsBeforeInvalidInput = fetcher.mock.calls.length;
    await user.type(chapter, "A");
    expect(chapter).toHaveValue("3");
    expect(fetcher).toHaveBeenCalledTimes(callsBeforeInvalidInput);
    expect(
      screen.queryByText("検索候補を読み込めませんでした。", {
        exact: false,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "架空ヨハネ/Synthetic John" }),
    ).toBeInTheDocument();
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

  it("keeps controls disabled while loading and announces an empty catalog", async () => {
    let resolveCatalog!: (response: Response) => void;
    const pendingCatalog = new Promise<Response>((resolve) => {
      resolveCatalog = resolve;
    });
    const fetcher = vi.fn<typeof fetch>((input) =>
      String(input).includes("/saved-content")
        ? response({ folders: [], orderIds: [] })
        : pendingCatalog,
    );
    renderSearch(fetcher);

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toHaveTextContent("検索候補を読み込んでいます。");
    expect(loadingStatus).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();

    resolveCatalog(Response.json({ books: [], chapters: [], verses: [] }));
    expect(
      await screen.findByText("利用できる聖書データがありません。"),
    ).toBeVisible();
  });

  it("ignores a stale catalog response after a newer selection completes", async () => {
    let resolveStale!: (response: Response) => void;
    const staleCatalog = new Promise<Response>((resolve) => {
      resolveStale = resolve;
    });
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input), "https://levi.example");
      if (!url.searchParams.has("book"))
        return response({ books, chapters: [], verses: [] });
      if (url.searchParams.get("language") === "both") return staleCatalog;
      return response({ books, chapters: [4], verses: [] });
    });
    const { result } = renderHook(() => useScriptureCatalog(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      void result.current.loadCatalog({
        book: "JHN",
        chapter: "",
        endVerse: "",
        language: "both",
        startVerse: "",
      });
      void result.current.loadCatalog({
        book: "JHN",
        chapter: "",
        endVerse: "",
        language: "ja",
        startVerse: "",
      });
    });
    await waitFor(() => expect(result.current.chapters).toEqual([4]));

    await act(async () => {
      resolveStale(Response.json({ books, chapters: [3], verses: [] }));
    });
    expect(result.current.chapters).toEqual([4]);
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
      "/scripture/audience?book=JHN&chapter=3&endVerse=17&language=both&startVerse=16",
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
    const toggleBlank = screen.getByRole("button", {
      name: "空白と表示を切り替え",
    });
    expect(larger).toBeDisabled();
    expect(smaller).toBeDisabled();
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
    expect(toggleBlank).toBeDisabled();

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
    await user.click(toggleBlank);
    expect(audiencePostMessage.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({ action: "font-larger", type: "CONTROL" }),
      expect.objectContaining({ action: "font-smaller", type: "CONTROL" }),
      expect.objectContaining({ action: "previous", type: "CONTROL" }),
      expect.objectContaining({ action: "next", type: "CONTROL" }),
      expect.objectContaining({ action: "toggle-blank", type: "CONTROL" }),
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

  it("disables controls for a closed audience and reconnects after Open", async () => {
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
          source: audienceTarget,
        }),
      ),
    );
    const larger = screen.getByRole("button", { name: "文字を大きく" });
    await waitFor(() => expect(larger).toBeEnabled());

    Object.assign(audienceTarget, { closed: true });
    await waitFor(() => expect(larger).toBeDisabled(), { timeout: 1_500 });

    Object.assign(audienceTarget, { closed: false });
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
      "/scripture/audience?book=JHN&chapter=3&endVerse=18&language=both&startVerse=16",
      "projector",
    );
  });

  it("saves only the start verse when the favorite end verse is omitted", async () => {
    const contentFetcher = statefulSavedContentFetcher();
    renderSearch(successfulFetcher(), contentFetcher);
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
    const favorite = await screen.findByRole("button", {
      name: "お気に入りに追加",
    });
    await waitFor(() => expect(favorite).toBeEnabled());
    await user.click(favorite);

    const createBookmarkCall = contentFetcher.mock.calls.find(([, init]) =>
      String(init?.body).includes('"action":"create-bookmark"'),
    );
    expect(JSON.parse(String(createBookmarkCall?.[1]?.body))).toMatchObject({
      book: "JHN",
      chapter: 3,
      endVerse: 16,
      startVerse: 16,
      title: "架空ヨハネ/Synthetic John 3:16",
    });
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
