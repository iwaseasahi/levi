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

const id = "00000000-0000-4000-8000-000000000387";
const generation = "00000000-0000-4000-8000-000000000388";
const slide = {
  id,
  revision: 1,
  title: "Private title",
  author: "Private author",
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
  it("renders only literal body, resumes page, changes URL and clears on visibility/revision checks", async () => {
    window.history.replaceState(null, "", `/slides/audience?id=${id}&page=1`);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ slide }));
    // Each response has an independent consumable body.
    fetcher.mockImplementation(async () => Response.json({ slide }));
    render(<SlideAudience id={id} page={1} fetcher={fetcher} />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(await screen.findByText("Second")).toBeVisible();
    expect(screen.queryByText(slide.title)).toBeNull();
    expect(screen.queryByText(slide.author)).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(
      await screen.findByText(/<script>synthetic<\/script>/),
    ).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(new URL(location.href).searchParams.get("page")).toBe("0");
    fetcher.mockImplementation(async () =>
      Response.json({ slide: { ...slide, revision: 2 } }),
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "更新されました",
    );
    expect(document.querySelector("pre")).toBeNull();
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
    render(<SlideAudience id={id} page={0} fetcher={fetcher} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.querySelector("pre")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("利用できません");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.querySelector("pre")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shows invalid page and initial read errors without protected text", async () => {
    const { unmount } = render(
      <SlideAudience
        id={id}
        page={2}
        fetcher={async () => Response.json({ slide })}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ページを表示できません",
    );
    expect(document.querySelector("pre")).toBeNull();
    unmount();
    render(
      <SlideAudience
        id={id}
        page={0}
        fetcher={async () => Response.json({ error: {} }, { status: 404 })}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "利用できません",
    );
  });
  it("shows acknowledged page/font/blank only, bounds controls and disables an unexpected saved revision including keys", async () => {
    const postMessage = vi.fn();
    const target = { postMessage, closed: false } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    const user = userEvent.setup();
    render(<SlideController slide={slide} />);
    expect(
      screen.getByRole("button", { name: "次のページへ投影" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(`/slides/audience?id=${id}&page=0#levi=`),
      "projector",
    );
    const [connect] = postMessage.mock.calls.at(-1)!;
    const presentation = {
      ready: true,
      authorized: true,
      fontScale: 1,
      blank: false,
    };
    const content = { id, page: 0, pageCount: 2, revision: 1, status: "ready" };
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
      screen.getByRole("button", { name: "前のページへ投影" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "次のページへ投影" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
    const ack = Object.fromEntries(
      Object.entries(ready).filter(([key]) => key !== "challenge"),
    );
    send(
      {
        ...ack,
        type: "ACK",
        sequence: 2,
        content: { ...content, page: 1 },
        presentation: { ...presentation, blank: true, fontScale: 2.2 },
      },
      target,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "空白投影 · 2 / 2 · 220%",
    );
    expect(
      screen.getByRole("button", { name: "次のページへ投影" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "文字を大きく" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("投影ページ"), "0");
    expect(postMessage.mock.calls.at(-1)![0].command).toEqual({
      action: "select-page",
      page: 0,
    });
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
    postMessage.mockClear();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(postMessage).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "次のページへ投影" }),
      ).toBeDisabled(),
    );
  });
});
