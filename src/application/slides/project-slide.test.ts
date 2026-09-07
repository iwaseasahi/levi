import { describe, expect, it, vi } from "vitest";
import type { SlideRecord } from "@/domain/slides/commands";
import { slideTextDocumentFromPlainText } from "@/domain/slides/text-document";
import { createSlideAudienceSession } from "./project-slide";

const slide: SlideRecord = {
  id: "00000000-0000-4000-8000-000000000387",
  revision: 1,
  title: "Synthetic",
  document: slideTextDocumentFromPlainText("First\n\n\n\nSecond\n\n\n\nThird"),
  verticalAlignment: "center",
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};

function setup() {
  const load = vi.fn(async () => slide);
  const publish = vi.fn();
  const session = createSlideAudienceSession({
    id: slide.id,
    load,
    publish,
  });
  return { load, publish, session };
}

describe("saved Slide audience lifetime", () => {
  it("starts once with the complete single-surface document", async () => {
    const { session, publish, load } = setup();
    await session.start();
    await session.start();
    expect(load).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "ready",
        document: slide.document,
        verticalAlignment: "center",
        revision: 1,
      }),
    );
    await expect(session.verify()).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    session.dispose();
    await expect(session.verify()).resolves.toBe(false);
    await session.start();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("publishes the saved whole-body alignment", async () => {
    const { session, publish, load } = setup();
    load.mockResolvedValue({ ...slide, verticalAlignment: "bottom" });
    await session.start();
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ verticalAlignment: "bottom" }),
    );
  });

  it("clears on revision change and refuses subsequent checks", async () => {
    const { session, publish, load } = setup();
    await session.start();
    load.mockResolvedValue({
      ...slide,
      revision: 2,
      document: slideTextDocumentFromPlainText("New content"),
    });
    await expect(session.verify()).resolves.toBe(false);
    expect(publish).toHaveBeenLastCalledWith({
      status: "stale",
      revision: 1,
    });
    await session.verify();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(["read", "verify"])(
    "clears on failed %s (denied/deleted/network) without revealing content",
    async (action) => {
      const { session, load, publish } = setup();
      if (action === "verify") await session.start();
      load.mockRejectedValue(new Error("synthetic restricted error"));
      if (action === "read") await session.start();
      else await session.verify();
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "unavailable" }),
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
        publish.mock.calls.some(([state]) => state.status === "ready"),
      ).toBe(false);
    },
  );

  it("a failed concurrent eligibility check prevents a late success from restoring text", async () => {
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
    const late = session.verify();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await session.verify();
    finish(slide);
    await late;
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "unavailable" }),
    );
    expect(session.isAuthorized()).toBe(false);
  });

  it("fails closed on mismatched identity and invalid saved document", async () => {
    for (const patch of [
      { id: "foreign" },
      { document: { version: 2, blocks: [] } },
    ]) {
      const { session, load, publish } = setup();
      load.mockResolvedValue({ ...slide, ...patch } as unknown as SlideRecord);
      await session.start();
      expect(publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "unavailable" }),
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
