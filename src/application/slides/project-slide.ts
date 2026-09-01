import type { SlideRecord } from "@/domain/slides/commands";
import type { SlideAudienceState } from "@/domain/slides/projection";
import { parseSlideBody } from "@/domain/slides/slide";

/** One document lifetime. A failed/disposed session cannot regain protected text. */
export function createSlideAudienceSession({
  id,
  load,
  publish,
}: {
  id: string;
  load: () => Promise<SlideRecord>;
  publish: (state: SlideAudienceState) => void;
}) {
  let disposed = false;
  let failed = false;
  let started = false;
  let state: SlideAudienceState = {
    status: "loading",
    text: null,
    revision: null,
  };
  function fail(status: "stale" | "unavailable" = "unavailable") {
    if (disposed || failed) return;
    failed = true;
    state = { status, text: null, revision: state.revision };
    publish(state);
  }
  async function start() {
    if (started || disposed) return;
    started = true;
    try {
      const slide = await load();
      if (disposed || failed) return;
      if (slide.id !== id) {
        fail();
        return;
      }
      state = {
        status: "ready",
        text: parseSlideBody(slide.body),
        revision: slide.revision,
      };
      publish(state);
    } catch {
      fail();
    }
  }
  async function verify() {
    if (disposed || failed || state.status !== "ready") return false;
    try {
      const slide = await load();
      if (disposed || failed) return false;
      if (slide.id !== id) {
        fail();
        return false;
      }
      if (slide.revision !== state.revision) {
        fail("stale");
        return false;
      }
      return true;
    } catch {
      fail();
      return false;
    }
  }
  return {
    start,
    verify,
    invalidate: () => fail(),
    isAuthorized: () => !disposed && !failed,
    dispose: () => {
      disposed = true;
      state = { status: "unavailable", text: null, revision: null };
    },
  };
}
