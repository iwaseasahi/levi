import type { SlideRecord } from "@/domain/slides/commands";
import type { SlideAudienceState } from "@/domain/slides/projection";
import { slidePages } from "@/domain/slides/slide";

/** One document lifetime. A failed/disposed session cannot regain protected text. */
export function createSlideAudienceSession({
  id,
  initialPage,
  load,
  publish,
  pageChanged,
}: {
  id: string;
  initialPage: number;
  load: () => Promise<SlideRecord>;
  publish: (state: SlideAudienceState) => void;
  pageChanged: (page: number) => void;
}) {
  let disposed = false;
  let failed = false;
  let started = false;
  let state: SlideAudienceState = {
    status: "loading",
    pages: [],
    page: initialPage,
    revision: null,
  };
  let queue = Promise.resolve();
  function fail(status: "invalid" | "stale" | "unavailable" = "unavailable") {
    if (disposed || failed) return;
    failed = true;
    state = { status, pages: [], page: 0, revision: state.revision };
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
      const pages = slidePages(slide.body);
      if (
        !Number.isInteger(initialPage) ||
        initialPage < 0 ||
        initialPage >= pages.length
      ) {
        fail("invalid");
        return;
      }
      state = {
        status: "ready",
        pages,
        page: initialPage,
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
  function navigate(direction: "previous" | "next" | number) {
    queue = queue
      .then(async () => {
        if (!(await verify())) return;
        const target =
          typeof direction === "number"
            ? direction
            : state.page + (direction === "next" ? 1 : -1);
        if (
          !Number.isInteger(target) ||
          target < 0 ||
          target >= state.pages.length
        )
          return;
        state = { ...state, page: target };
        publish(state);
        pageChanged(target);
      })
      .catch(() => fail());
    return queue;
  }
  return {
    start,
    verify,
    navigate,
    invalidate: () => fail(),
    isAuthorized: () => !disposed && !failed,
    dispose: () => {
      disposed = true;
      state = { status: "unavailable", pages: [], page: 0, revision: null };
    },
  };
}
