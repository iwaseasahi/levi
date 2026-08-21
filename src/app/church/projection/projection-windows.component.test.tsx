import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  projectionSchema,
  projectionVersion,
  type ControllerProjectionMessage,
} from "@/domain/projection/state";
import { AudienceDisplay } from "../audience/audience-display";
import { audienceHeading, ProjectionController } from "./projection-controller";

const selection = {
  book: "GEN",
  chapter: 1,
  endVerse: 2,
  language: "both" as const,
  startVerse: 1,
};
const items = [1, 2].map((verse) => ({
  location: { book: "GEN", chapter: 1, verse },
  texts: {
    english: {
      bookName: "Genesis",
      text:
        verse === 1
          ? "In the beginning God created the heavens and the earth."
          : "E2E English test text 2",
      translation: "NKJV" as const,
    },
    japanese: {
      bookName: "創世記",
      text:
        verse === 1 ? "初めに、神が天と地を創造した。" : "E2E用日本語本文 2",
      translation: "JSS3" as const,
    },
  },
}));
const item3 = {
  location: { book: "GEN", chapter: 1, verse: 3 },
  texts: {
    english: {
      bookName: "Genesis",
      text: "E2E English test text 1:3",
      translation: "NKJV" as const,
    },
    japanese: {
      bookName: "創世記",
      text: "E2E用日本語本文 1:3",
      translation: "JSS3" as const,
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("projection windows", () => {
  it("formats bilingual and single-language headings with chapter and verse", () => {
    const chapter4Verse1 = {
      ...items[0]!,
      location: { book: "GEN", chapter: 4, verse: 1 },
    };
    expect(audienceHeading(chapter4Verse1)).toBe("新改訳聖書第3版 創世記 4:1");
    expect(
      audienceHeading({
        ...chapter4Verse1,
        texts: { japanese: chapter4Verse1.texts.japanese },
      }),
    ).toBe("新改訳聖書第3版 創世記 4:1");
    expect(
      audienceHeading({
        ...chapter4Verse1,
        texts: { english: chapter4Verse1.texts.english },
      }),
    ).toBe("新改訳聖書第3版 Genesis 4:1");
  });

  it("opens an ordinary tab and reports when the new tab is blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ items }))),
    );
    vi.spyOn(window, "open").mockReturnValue(null);
    const { container } = render(
      <ProjectionController selection={selection} />,
    );
    await screen.findByRole("heading", { name: "投影操作" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "会衆向け画面を新しいタブで開く",
      }),
    );
    expect(window.open).toHaveBeenCalledWith("/church/audience", "_blank");
    expect(screen.getByRole("status")).toHaveTextContent("ブロックされました");
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("handshakes with the expected window and sends only the current item", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/api/scripture/navigate")
        ? Promise.resolve(
            Response.json({
              crossedChapter: false,
              edge: null,
              item: items[1],
            }),
          )
        : Promise.resolve(Response.json({ items })),
    );
    vi.stubGlobal("fetch", fetcher);
    const popupPostMessage = vi.fn();
    const popup = {
      closed: false,
      postMessage: popupPostMessage,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<ProjectionController selection={selection} />);
    await screen.findByRole("heading", { name: "投影操作" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "会衆向け画面を新しいタブで開く",
      }),
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            schema: projectionSchema,
            type: "READY",
            version: projectionVersion,
          },
          origin: window.location.origin,
          source: popup,
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("接続しています"),
    );
    await waitFor(() =>
      expect(popupPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            heading: "新改訳聖書第3版 創世記 1:1",
            translations: [
              {
                language: "ja",
                text: "初めに、神が天と地を創造した。",
              },
              {
                language: "en",
                text: "In the beginning God created the heavens and the earth.",
              },
            ],
            verseNumber: 1,
          }),
          type: "STATE",
        }),
        window.location.origin,
      ),
    );
    expect(JSON.stringify(popupPostMessage.mock.calls)).not.toContain(
      "E2E用日本語本文 2",
    );
    const stateMessage = popupPostMessage.mock.calls.find(
      ([message]) => (message as ControllerProjectionMessage).type === "STATE",
    )?.[0] as Extract<ControllerProjectionMessage, { type: "STATE" }>;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            direction: "next",
            schema: projectionSchema,
            sessionId: stateMessage.payload.sessionId,
            type: "NAVIGATE",
            version: projectionVersion,
          },
          origin: window.location.origin,
          source: popup,
        }),
      );
    });
    await screen.findByRole("heading", { name: "創世記 1:2" });
    await waitFor(() =>
      expect(popupPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            heading: "新改訳聖書第3版 創世記 1:2",
            verseNumber: 2,
          }),
          type: "STATE",
        }),
        window.location.origin,
      ),
    );
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).includes("/api/scripture/navigate"),
      ),
    ).toHaveLength(1);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            direction: "previous",
            schema: projectionSchema,
            sessionId: stateMessage.payload.sessionId,
            type: "NAVIGATE",
            version: projectionVersion,
          },
          origin: "https://invalid.example",
          source: popup,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            direction: "previous",
            schema: projectionSchema,
            sessionId: "00000000-0000-4000-8000-000000000099",
            type: "NAVIGATE",
            version: projectionVersion,
          },
          origin: window.location.origin,
          source: popup,
        }),
      );
    });
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).includes("/api/scripture/navigate"),
      ),
    ).toHaveLength(1);
  });

  it("processes rapid navigation actions serially in input order", async () => {
    let resolveFirst!: (value: Response) => void;
    const firstNavigation = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/scripture/search"))
        return Promise.resolve(Response.json({ items }));
      if (url.includes("verse=1")) return firstNavigation;
      return Promise.resolve(
        Response.json({ crossedChapter: false, edge: null, item: item3 }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<ProjectionController selection={selection} />);
    await screen.findByRole("heading", { name: "投影操作" });

    const next = screen.getByRole("button", { name: "次へ" });
    await userEvent.click(next);
    await userEvent.click(next);
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).includes("/api/scripture/navigate"),
        ),
      ).toHaveLength(1),
    );

    resolveFirst(
      Response.json({ crossedChapter: false, edge: null, item: items[1] }),
    );
    await screen.findByRole("heading", { name: "創世記 1:3" });
    const navigationCalls = fetcher.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/api/scripture/navigate"));
    expect(navigationCalls).toHaveLength(2);
    expect(navigationCalls[0]).toContain("verse=1");
    expect(navigationCalls[1]).toContain("verse=2");
  });

  it("removes controller text and controls when session eligibility is lost", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/api/scripture/search")
        ? Promise.resolve(Response.json({ items }))
        : Promise.resolve(new Response(null, { status: 401 })),
    );
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<ProjectionController selection={selection} />);
    await screen.findByRole("heading", { name: "投影操作" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      await screen.findByText(
        "セッションを確認できないため、投影操作と本文の表示を終了しました。",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "投影操作" })).toBeNull();
    expect(screen.queryByText("初めに、神が天と地を創造した。")).toBeNull();
  });

  it("renders only the selected translation for a single-language state", async () => {
    const postMessage = vi.fn();
    const opener = { postMessage } as unknown as Window;
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: opener,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );
    render(<AudienceDisplay />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            schema: projectionSchema,
            type: "STATE",
            version: projectionVersion,
            payload: {
              blank: false,
              fontScale: 1,
              heading: "新改訳聖書第3版 Genesis 1:1",
              revision: 1,
              scrollDirection: null,
              scrollRevision: 0,
              sessionId: "00000000-0000-4000-8000-000000000052",
              verseNumber: 1,
              translations: [
                {
                  language: "en",
                  text: "In the beginning God created the heavens and the earth.",
                },
              ],
            },
          } satisfies ControllerProjectionMessage,
          origin: window.location.origin,
          source: opener,
        }),
      );
    });

    expect(
      await screen.findByText(
        "In the beginning God created the heavens and the earth.",
      ),
    ).toHaveAttribute("lang", "en");
    expect(document.querySelectorAll(".audience-book-word")).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        name: "新改訳聖書第3版 Genesis 1:1",
      }),
    ).toHaveClass("audience-book-name");
    expect(screen.queryByText("初めに、神が天と地を創造した。")).toBeNull();

    const initialMessages = postMessage.mock.calls.length;
    const down = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "ArrowDown",
    });
    act(() => window.dispatchEvent(down));
    expect(down.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        direction: "next",
        schema: projectionSchema,
        sessionId: "00000000-0000-4000-8000-000000000052",
        type: "NAVIGATE",
        version: projectionVersion,
      },
      window.location.origin,
    );

    const up = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "ArrowUp",
    });
    act(() => window.dispatchEvent(up));
    expect(up.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: "previous", type: "NAVIGATE" }),
      window.location.origin,
    );

    const other = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "ArrowLeft",
    });
    act(() => window.dispatchEvent(other));
    expect(other.defaultPrevented).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(initialMessages + 2);
  });

  it("renders Ginmaku markup in Japanese-English order and clears text on auth loss", async () => {
    const postMessage = vi.fn();
    const opener = { postMessage } as unknown as Window;
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: opener,
    });
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 401 })),
    );
    vi.stubGlobal("fetch", fetcher);
    const scrollBy = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<AudienceDisplay />);

    const payload: ControllerProjectionMessage = {
      schema: projectionSchema,
      type: "STATE",
      version: projectionVersion,
      payload: {
        blank: false,
        fontScale: 1,
        heading: "新改訳聖書第3版 創世記 1:1",
        revision: 1,
        scrollDirection: "down",
        scrollRevision: 1,
        sessionId: "00000000-0000-4000-8000-000000000051",
        verseNumber: 1,
        translations: [
          {
            language: "ja",
            text: "初めに、神が天と地を創造した。",
          },
          {
            language: "en",
            text: "In the beginning God created the heavens and the earth.",
          },
        ],
      },
    };
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: payload,
          origin: window.location.origin,
          source: opener,
        }),
      );
    });
    expect(
      await screen.findByText("初めに、神が天と地を創造した。"),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "新改訳聖書第3版 創世記 1:1",
      }),
    ).toHaveClass("audience-book-name");
    const lines = document.querySelectorAll(".audience-book-word");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("lang", "ja");
    expect(lines[1]).toHaveAttribute("lang", "en");
    expect(lines[0]).toHaveClass("audience-shadow");
    expect(document.querySelectorAll(".audience-verse-number")).toHaveLength(2);
    expect(document.querySelector(".audience-translation")).toBeNull();
    expect(scrollBy).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { ...payload, payload: { ...payload.payload, revision: 99 } },
          origin: "https://invalid.example",
          source: opener,
        }),
      );
    });
    expect(screen.getByText("初めに、神が天と地を創造した。")).toBeVisible();

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      await screen.findByText(
        "セッションを確認できないため、表示を終了しました。",
      ),
    ).toBeVisible();
    expect(screen.queryByText("初めに、神が天と地を創造した。")).toBeNull();
    const messagesBeforeKey = postMessage.mock.calls.length;
    const downAfterAuthLoss = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "ArrowDown",
    });
    act(() => window.dispatchEvent(downAfterAuthLoss));
    expect(downAfterAuthLoss.defaultPrevented).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(messagesBeforeKey);
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            ...payload,
            payload: { ...payload.payload, revision: 2 },
          },
          origin: window.location.origin,
          source: opener,
        }),
      );
    });
    expect(screen.queryByText("初めに、神が天と地を創造した。")).toBeNull();
  });
});
