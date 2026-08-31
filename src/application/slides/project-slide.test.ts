import { describe, expect, it, vi } from "vitest";
import type { SlideRecord } from "@/domain/slides/commands";
import { createSlideAudienceSession } from "./project-slide";

const slide: SlideRecord = {
  id: "00000000-0000-4000-8000-000000000387",
  revision: 1,
  title: "Synthetic",
  body: "First\n\n\n\nSecond\n\n\n\nThird",
  author: null,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};
function setup(initialPage = 0) {
  const load = vi.fn(async () => slide);
  const publish = vi.fn();
  const pageChanged = vi.fn();
  const session = createSlideAudienceSession({
    id: slide.id,
    initialPage,
    load,
    publish,
    pageChanged,
  });
  return { load, publish, pageChanged, session };
}
describe("saved Slide audience lifetime", () => {
  it("starts once, serializes rapid navigation, bounds pages and resumes an explicit page", async () => {
    const { session, publish, load, pageChanged } = setup(1);
    await session.start();
    await session.start();
    expect(load).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith({
      status: "ready",
      pages: ["First", "Second", "Third"],
      page: 1,
      revision: 1,
    });
    await Promise.all([
      session.navigate("next"),
      session.navigate("next"),
      session.navigate("previous"),
    ]);
    expect(pageChanged.mock.calls.flat()).toEqual([2, 1]);
    await session.navigate(0);
    await session.navigate("previous");
    await session.navigate(3);
    await session.navigate(0.5);
    expect(pageChanged).toHaveBeenLastCalledWith(0);
    expect(load).toHaveBeenCalledTimes(8);
    session.dispose();
    await session.navigate("next");
    await session.start();
    expect(load).toHaveBeenCalledTimes(8);
  });
  it.each([-1, 3, 0.5])(
    "rejects out-of-bounds initial page %s without clamping",
    async (page) => {
      const { session, publish } = setup(page);
      await session.start();
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "invalid", pages: [] }),
      );
      expect(session.isAuthorized()).toBe(false);
    },
  );
  it("clears on revision change and refuses subsequent commands/checks", async () => {
    const { session, publish, load } = setup();
    await session.start();
    load.mockResolvedValue({ ...slide, revision: 2, body: "New content" });
    await session.navigate("next");
    expect(publish).toHaveBeenLastCalledWith({
      status: "stale",
      pages: [],
      page: 0,
      revision: 1,
    });
    await session.verify();
    await session.navigate("next");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it.each(["read", "verify", "navigate"])(
    "clears on failed %s (denied/deleted/network) without revealing content",
    async (action) => {
      const { session, load, publish } = setup();
      if (action !== "read") await session.start();
      load.mockRejectedValue(new Error("synthetic restricted error"));
      if (action === "read") await session.start();
      else if (action === "verify") await session.verify();
      else await session.navigate("next");
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "unavailable", pages: [] }),
      );
      expect(JSON.stringify(publish.mock.calls.at(-1))).not.toContain(
        "restricted",
      );
      expect(session.isAuthorized()).toBe(false);
    },
  );
  it.each(["invalidate", "dispose"] as const)(
    "ignores an initial read completed after %s",
    async (action) => {
      const { session, load, publish } = setup();
      let finish!: (value: SlideRecord) => void;
      load.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const started = session.start();
      session[action]();
      finish(slide);
      await started;
      expect(
        publish.mock.calls.every(([state]) => state.pages.length === 0),
      ).toBe(true);
    },
  );
  it("a failed concurrent eligibility check prevents late navigation from restoring text", async () => {
    const { session, load, publish } = setup();
    await session.start();
    let finish!: (value: SlideRecord) => void;
    load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("denied"));
    const navigation = session.navigate("next");
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await session.verify();
    finish(slide);
    await navigation;
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "unavailable", pages: [] }),
    );
    expect(session.isAuthorized()).toBe(false);
  });
  it("fails closed on mismatched identity and invalid saved body", async () => {
    for (const patch of [{ id: "foreign" }, { body: " " }]) {
      const { session, load, publish } = setup();
      load.mockResolvedValue({ ...slide, ...patch });
      await session.start();
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "unavailable", pages: [] }),
      );
    }
    const { session, load, publish } = setup();
    await session.start();
    load.mockResolvedValue({ ...slide, id: "foreign" });
    await session.verify();
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "unavailable" }),
    );
  });
});
