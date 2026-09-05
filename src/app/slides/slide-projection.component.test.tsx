import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlideAudience } from "./slide-audience";
import { SlideController } from "./slide-controller";
import { SlideText } from "./slide-text";

const id = "00000000-0000-4000-8000-000000000387";
const generation = "00000000-0000-4000-8000-000000000388";
const slide = {
  id,
  revision: 1,
  title: "Private title",
  body: "<script>synthetic</script>\n日本語\n\n\n\nSecond",
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
function send(data: unknown, source: MessageEventSource) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", { source, origin: location.origin, data }),
    ),
  );
}
describe("Slide audience and controller", () => {
  it("uses the scripture projection typography and proportional base size", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1920);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
      1080,
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(960);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(540);
    const { container } = render(<SlideText text="日本語の本文" />);
    const text = container.querySelector(".slide-rich-content");
    expect(text).toHaveClass("audience-shadow");
    expect(text).toHaveStyle({ fontSize: "129.6px" });
  });

  it("renders the version 2 rich-text allowlist without HTML injection", () => {
    render(
      <SlideText
        text={"Lead\nItem"}
        document={{
          version: 2,
          blocks: [
            {
              type: "paragraph",
              alignment: "center",
              content: [
                {
                  type: "text",
                  text: "Lead",
                  size: 120,
                  marks: ["bold", "italic", "underline"],
                },
              ],
            },
            {
              type: "bulletList",
              items: [
                {
                  alignment: "right",
                  content: [
                    {
                      type: "text",
                      text: "Item",
                      size: 100,
                      marks: [],
                    },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );
    const lead = screen.getByText("Lead").closest("p")!;
    expect(lead).toHaveStyle({ textAlign: "center" });
    expect(lead.innerHTML).toContain("font-size: 1.2em");
    expect(lead.innerHTML).toContain("font-weight: 700");
    expect(lead.innerHTML).toContain("font-style: italic");
    expect(lead.innerHTML).toContain("text-decoration: underline");
    const item = screen.getByRole("listitem");
    expect(screen.getByRole("list")).toContainElement(item);
    expect(item).toHaveTextContent("Item");
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders the complete literal body and clears on visibility/revision checks", async () => {
    window.history.replaceState(null, "", `/slides/audience?id=${id}`);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ slide }));
    // Each response has an independent consumable body.
    fetcher.mockImplementation(async () => Response.json({ slide }));
    render(<SlideAudience id={id} fetcher={fetcher} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toBeEmptyDOMElement();
    const literal = await screen.findByText(/<script>synthetic<\/script>/);
    expect(literal.closest(".slide-rich-content")?.textContent).toBe(
      slide.body,
    );
    expect(screen.queryByText(slide.title)).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(new URL(location.href).searchParams.has("page")).toBe(false);
    fetcher.mockImplementation(async () =>
      Response.json({ slide: { ...slide, revision: 2 } }),
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "更新されました",
    );
    expect(document.querySelector(".slide-rich-content")).toBeNull();
    expect(
      fetcher.mock.calls.every(([, init]) => init?.cache === "no-store"),
    ).toBe(true);
  });
  it("reauthorizes on the 30-second cycle and never renders content after denial", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ slide }))
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 403 }));
    render(<SlideAudience id={id} fetcher={fetcher} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.querySelector(".slide-rich-content")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("利用できません");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.querySelector(".slide-rich-content")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shows initial read errors without protected text", async () => {
    render(
      <SlideAudience
        id={id}
        fetcher={async () => Response.json({ error: {} }, { status: 404 })}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "利用できません",
    );
  });
  it("does not flash connection or authorization alerts while the projection tab is closing", () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    const target = { postMessage, closed: false } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    render(<SlideController slide={slide} />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const [connect] = postMessage.mock.calls.at(-1)!;
    send(
      {
        ...connect,
        type: "READY",
        instance: generation,
        sequence: 1,
        presentation: {
          ready: true,
          authorized: true,
          fontScale: 1,
          blank: false,
        },
        content: {
          id,
          page: 0,
          pageCount: 1,
          revision: 1,
          status: "ready",
        },
      },
      target,
    );
    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeEnabled();

    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const unauthorized = Object.fromEntries(
      Object.entries({
        ...connect,
        type: "READY",
        instance: generation,
        sequence: 1,
        presentation: {
          ready: true,
          authorized: true,
          fontScale: 1,
          blank: false,
        },
        content: {
          id,
          page: 0,
          pageCount: 1,
          revision: 1,
          status: "ready",
        },
      }).filter(([key]) => key !== "challenge"),
    );
    send(
      {
        ...unauthorized,
        type: "ACK",
        sequence: 2,
        presentation: {
          ready: false,
          authorized: false,
          fontScale: 1,
          blank: false,
        },
      },
      target,
    );
    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    Object.assign(target, { closed: true });
    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeDisabled();
    expect(
      screen.queryByText("投映画面を閉じました。再度Openしてください。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "表示の利用資格を確認できません。再度Openしてください。",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows single-page font/blank controls and disables an unexpected saved revision", async () => {
    const postMessage = vi.fn();
    const target = { postMessage, closed: false } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    const user = userEvent.setup();
    render(<SlideController slide={slide} />);
    expect(screen.queryByRole("heading", { name: "投影" })).toBeNull();
    expect(screen.getByRole("region", { name: "投影操作" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "文字を大きく" }),
    ).toHaveTextContent("文字 +");
    expect(
      screen.getByRole("button", { name: "文字を小さく" }),
    ).toHaveTextContent("文字 -");
    expect(
      screen.getByRole("button", { name: "空白と表示を切り替え" }),
    ).toHaveTextContent("空白⇔表示");
    expect(
      screen.getByRole("button", { name: "お気に入りに追加" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "次のページへ投影" }),
    ).toBeNull();
    expect(screen.queryByLabelText("投影ページ")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(`/slides/audience?id=${id}#levi=`),
      "projector",
    );
    const [connect] = postMessage.mock.calls.at(-1)!;
    const presentation = {
      ready: true,
      authorized: true,
      fontScale: 1,
      blank: false,
    };
    const content = { id, page: 0, pageCount: 1, revision: 1, status: "ready" };
    const ready = {
      ...connect,
      type: "READY",
      instance: generation,
      sequence: 1,
      presentation,
      content,
    };
    send(ready, target);
    expect(
      screen.queryByRole("button", { name: "前のページへ投影" }),
    ).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("投影中 · 100%");
    postMessage.mockClear();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(postMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "文字を大きく" }));
    expect(postMessage.mock.calls.at(-1)![0].command).toEqual({
      action: "font-larger",
    });
    const ack = Object.fromEntries(
      Object.entries(ready).filter(([key]) => key !== "challenge"),
    );
    send(
      {
        ...ack,
        type: "ACK",
        sequence: 2,
        presentation: { ...presentation, blank: true, fontScale: 2.2 },
      },
      target,
    );
    expect(screen.getByRole("status")).toHaveTextContent("空白投影 · 220%");
    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeDisabled();
    send(
      {
        ...ack,
        type: "ACK",
        sequence: 3,
        content: { ...content, revision: 2 },
      },
      target,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("更新されました");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "文字を小さく" }),
      ).toBeDisabled(),
    );
  });
  it("saves the detail Slide to the selected folder and reports a later failure", async () => {
    const folderId = "00000000-0000-4000-8000-000000000420";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ item: {} }))
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 500 }));
    const onFavoriteSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <SlideController
        slide={slide}
        fetcher={fetcher}
        selectedFolderId={folderId}
        onFavoriteSaved={onFavoriteSaved}
      />,
    );
    const blank = screen.getByRole("button", {
      name: "空白と表示を切り替え",
    });
    const favorite = screen.getByRole("button", {
      name: "お気に入りに追加",
    });
    expect(blank.nextElementSibling).toBe(favorite);
    await user.click(favorite);
    await waitFor(() => expect(onFavoriteSaved).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenLastCalledWith("/api/saved-content", {
      body: JSON.stringify({
        action: "create-slide-bookmark",
        folderId,
        slideId: slide.id,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    await user.click(favorite);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "お気に入りに追加できませんでした",
    );
    expect(onFavoriteSaved).toHaveBeenCalledOnce();
  });
});
