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
import { ProjectionController } from "./projection-controller";

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("projection windows", () => {
  it("renders accessible controls and reports a blocked popup", async () => {
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
      screen.getByRole("button", { name: "会衆向け画面を開く" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("ブロックされました");
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("handshakes with the expected window and sends only the current item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ items }))),
    );
    const popupPostMessage = vi.fn();
    const popup = {
      closed: false,
      postMessage: popupPostMessage,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<ProjectionController selection={selection} />);
    await screen.findByRole("heading", { name: "投影操作" });
    await userEvent.click(
      screen.getByRole("button", { name: "会衆向け画面を開く" }),
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
            reference: "創世記 1:1",
            translations: expect.arrayContaining([
              expect.objectContaining({
                text: "初めに、神が天と地を創造した。",
              }),
            ]),
          }),
          type: "STATE",
        }),
        window.location.origin,
      ),
    );
    expect(JSON.stringify(popupPostMessage.mock.calls)).not.toContain(
      "E2E用日本語本文 2",
    );
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

  it("ignores invalid messages, scrolls once, and clears text on auth loss", async () => {
    const opener = { postMessage: vi.fn() } as unknown as Window;
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
        reference: "創世記 1:1",
        revision: 1,
        scrollDirection: "down",
        scrollRevision: 1,
        sessionId: "00000000-0000-4000-8000-000000000051",
        translations: [
          {
            language: "ja",
            name: "新改訳聖書第3版（JSS3）",
            text: "初めに、神が天と地を創造した。",
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
