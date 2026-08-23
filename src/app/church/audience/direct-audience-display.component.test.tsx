import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectAudienceDisplay } from "./direct-audience-display";

const selection = {
  book: "GEN",
  chapter: 1,
  endVerse: 2,
  language: "both" as const,
  startVerse: 1,
};

function item(verse: number, book = "GEN", chapter = 1) {
  return {
    location: { book, chapter, verse },
    texts: {
      english: {
        bookName: book === "GEN" ? "Genesis" : "Exodus",
        text: `Synthetic English ${chapter}:${verse}`,
        translation: "NKJV" as const,
      },
      japanese: {
        bookName: book === "GEN" ? "創世記" : "出エジプト記",
        text: `架空の日本語 ${chapter}:${verse}`,
        translation: "JSS3" as const,
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DirectAudienceDisplay", () => {
  it("renders Ginmaku Japanese-English order and navigates with arrow keys", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/scripture/search"))
        return Promise.resolve(Response.json({ items: [item(1), item(2)] }));
      return Promise.resolve(
        Response.json({
          crossedBook: false,
          crossedChapter: false,
          edge: null,
          item: item(2),
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(
      <DirectAudienceDisplay selection={selection} />,
    );

    expect(await screen.findByText("架空の日本語 1:1")).toHaveAttribute(
      "lang",
      "ja",
    );
    expect(screen.getByText("Synthetic English 1:1")).toHaveAttribute(
      "lang",
      "en",
    );
    const lines = container.querySelectorAll(".audience-book-word");
    expect(lines[0]).toHaveAttribute("lang", "ja");
    expect(lines[1]).toHaveAttribute("lang", "en");

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })),
    );
    expect(await screen.findByText("架空の日本語 1:2")).toBeVisible();
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).includes("direction=next"),
      ),
    ).toBe(true);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("serializes navigation and accepts chapter and book boundary items", async () => {
    let finishFirst!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => {
      finishFirst = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/scripture/search"))
        return Promise.resolve(Response.json({ items: [item(2)] }));
      if (url.includes("book=GEN") && url.includes("chapter=1")) return first;
      return Promise.resolve(
        Response.json({
          crossedBook: true,
          crossedChapter: true,
          edge: null,
          item: item(1, "EXO"),
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<DirectAudienceDisplay selection={selection} />);
    await screen.findByText("架空の日本語 1:2");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).includes("/api/scripture/navigate"),
        ),
      ).toHaveLength(1),
    );
    finishFirst(
      Response.json({
        crossedBook: false,
        crossedChapter: true,
        edge: null,
        item: item(1, "GEN", 2),
      }),
    );
    expect(await screen.findByText("架空の日本語 1:1")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "新改訳聖書第3版 出エジプト記 1:1",
      }),
    ).toBeVisible();
  });

  it("accepts Ginmaku display controls only from its opener", async () => {
    const opener = { postMessage: vi.fn() } as unknown as Window;
    vi.stubGlobal("opener", opener);
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/scripture/search"))
        return Promise.resolve(Response.json({ items: [item(1)] }));
      return Promise.resolve(
        Response.json({
          crossedBook: false,
          crossedChapter: false,
          edge: null,
          item: url.includes("direction=previous") ? item(1) : item(2),
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(
      <DirectAudienceDisplay selection={selection} />,
    );
    await screen.findByText("架空の日本語 1:1");
    expect(opener.postMessage).toHaveBeenCalledWith(
      {
        schema: "levi.direct-audience",
        type: "READY",
        version: 1,
      },
      window.location.origin,
    );

    const send = (action: string, source: MessageEventSource = opener) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            action,
            schema: "levi.direct-audience",
            type: "CONTROL",
            version: 1,
          },
          origin: window.location.origin,
          source,
        }),
      );
    act(() => send("font-larger"));
    expect(container.querySelector(".audience-screen")).toHaveStyle({
      "--audience-scale": "1.1",
    });
    act(() => send("font-smaller"));
    expect(container.querySelector(".audience-screen")).toHaveStyle({
      "--audience-scale": "1",
    });
    act(() => send("toggle-blank"));
    expect(screen.getByRole("main", { name: "空白投影" })).toBeVisible();
    expect(screen.queryByText("架空の日本語 1:1")).not.toBeInTheDocument();
    act(() => send("next"));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          String(input).includes("direction=next"),
        ),
      ).toBe(true),
    );
    expect(screen.queryByText("架空の日本語 1:2")).not.toBeInTheDocument();
    act(() => send("toggle-blank"));
    expect(await screen.findByText("架空の日本語 1:2")).toBeVisible();

    act(() => send("font-larger", {} as MessageEventSource));
    expect(container.querySelector(".audience-screen")).toHaveStyle({
      "--audience-scale": "1",
    });
    act(() => send("toggle-blank", {} as MessageEventSource));
    expect(
      screen.queryByRole("main", { name: "空白投影" }),
    ).not.toBeInTheDocument();
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            action: "toggle-blank",
            schema: "levi.direct-audience",
            type: "CONTROL",
            version: 1,
          },
          origin: "https://untrusted.example",
          source: opener,
        }),
      ),
    );
    expect(screen.getByText("架空の日本語 1:2")).toBeVisible();
  });

  it("fails closed when the active session is denied", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/api/scripture/search")
        ? Promise.resolve(Response.json({ items: [item(1)] }))
        : Promise.resolve(new Response(null, { status: 401 })),
    );
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<DirectAudienceDisplay selection={selection} />);
    await screen.findByText("架空の日本語 1:1");

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      await screen.findByText(
        "セッションを確認できないため、表示を終了しました。",
      ),
    ).toBeVisible();
    expect(screen.queryByText("架空の日本語 1:1")).not.toBeInTheDocument();
  });

  it("does not restore protected text when navigation finishes after fail-close", async () => {
    let finishNavigation!: (value: Response) => void;
    const navigation = new Promise<Response>((resolve) => {
      finishNavigation = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/scripture/search"))
        return Promise.resolve(Response.json({ items: [item(1)] }));
      if (url.includes("/api/scripture/navigate")) return navigation;
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<DirectAudienceDisplay selection={selection} />);
    await screen.findByText("架空の日本語 1:1");

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          String(input).includes("/api/scripture/navigate"),
        ),
      ).toBe(true),
    );
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      await screen.findByText(
        "セッションを確認できないため、表示を終了しました。",
      ),
    ).toBeVisible();

    await act(async () => {
      finishNavigation(
        Response.json({
          crossedBook: false,
          crossedChapter: false,
          edge: null,
          item: item(2),
        }),
      );
      await navigation;
    });
    expect(screen.queryByText("架空の日本語 1:1")).not.toBeInTheDocument();
    expect(screen.queryByText("架空の日本語 1:2")).not.toBeInTheDocument();
    expect(
      screen.getByText("セッションを確認できないため、表示を終了しました。"),
    ).toBeVisible();
  });
});
