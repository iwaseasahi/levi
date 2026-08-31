import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseScriptureProjectionState } from "@/domain/scripture/projection-state";
import { projectionEnvelope } from "@/domain/projection/transport";
import { useProjectionController } from "./use-projection-controller";
import { useProjectionAudience } from "./use-projection-audience";

const generation = "00000000-0000-4000-8000-000000000386";
const second = "00000000-0000-4000-8000-000000000387";
const content = { location: { book: "GEN", chapter: 1, verse: 1 } };
const presentation = {
  ready: true,
  authorized: true,
  fontScale: 1,
  blank: false,
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
function send(
  data: unknown,
  source: MessageEventSource,
  origin = window.location.origin,
) {
  act(() =>
    window.dispatchEvent(new MessageEvent("message", { data, source, origin })),
  );
}

describe("projection controller transport", () => {
  it("requires current challenge/kind/generation/source and monotonic ACK; reopen drops old state", () => {
    const postMessage = vi.fn();
    const target = { closed: false, postMessage } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    const { result } = renderHook(() =>
      useProjectionController("scripture", parseScriptureProjectionState),
    );
    act(() => result.current.open("/scripture/audience?book=GEN"));
    const [connect] = postMessage.mock.calls.at(-1)!;
    const ready = {
      ...connect,
      type: "READY",
      instance: generation,
      sequence: 1,
      presentation,
      content,
    };
    for (const patch of [
      { challenge: second },
      { generation: second },
      { kind: "slide" },
      { version: 1 },
      { extra: true },
      { content: { location: null, extra: true } },
    ])
      send({ ...ready, ...patch }, target);
    send(ready, {} as Window);
    send(ready, target, "https://foreign.example");
    expect(result.current.ready).toBe(false);
    send(ready, target);
    expect(result.current.ready).toBe(true);
    const ack = Object.fromEntries(
      Object.entries(ready).filter(([key]) => key !== "challenge"),
    );
    send(
      {
        ...ack,
        type: "ACK",
        sequence: 3,
        presentation: { ...presentation, blank: true },
      },
      target,
    );
    expect(result.current.state?.presentation.blank).toBe(true);
    send({ ...ack, type: "ACK", sequence: 2 }, target);
    send({ ...ack, type: "ACK", sequence: 4, instance: second }, target);
    expect(result.current.state?.presentation.blank).toBe(true);
    act(() => result.current.control({ action: "next" }));
    expect(postMessage.mock.calls.at(-1)![0]).toMatchObject({
      type: "CONTROL",
      instance: generation,
      sequence: 1,
      command: { action: "next" },
    });
    act(() => result.current.open("/scripture/audience?book=EXO"));
    send(ready, target);
    send({ ...ack, type: "ACK", sequence: 99 }, target);
    expect(result.current.ready).toBe(false);
  });
  it("distinguishes a reload instance and expires incompatible or disconnected peers", () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    const target = { closed: false, postMessage } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    const { result } = renderHook(() =>
      useProjectionController("scripture", parseScriptureProjectionState),
    );
    act(() => result.current.open("/scripture/audience"));
    const [connect] = postMessage.mock.calls.at(-1)!;
    const ready = {
      ...connect,
      type: "READY",
      instance: generation,
      sequence: 90,
      presentation,
      content,
    };
    send(ready, target);
    act(() => vi.advanceTimersByTime(1000));
    const [probe] = postMessage.mock.calls.at(-1)!;
    send(
      { ...ready, ...probe, type: "READY", instance: second, sequence: 1 },
      target,
    );
    expect(result.current.ready).toBe(true);
    const ack = Object.fromEntries(
      Object.entries(ready).filter(([key]) => key !== "challenge"),
    );
    send(
      {
        ...ack,
        type: "ACK",
        sequence: 100,
        presentation: { ...presentation, blank: true },
      },
      target,
    );
    expect(result.current.state?.presentation.blank).toBe(false);
    send(
      {
        ...ready,
        ...probe,
        type: "READY",
        presentation: { ...presentation, blank: true },
      },
      target,
    );
    expect(result.current.state?.presentation.blank).toBe(false);
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toContain("両画面を更新して再度Open");
  });
  it("does not steal arrows from inputs, textareas, editable elements or IME", () => {
    const postMessage = vi.fn();
    const target = { closed: false, postMessage } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(target);
    const { result } = renderHook(() =>
      useProjectionController("scripture", parseScriptureProjectionState),
    );
    act(() => result.current.open("/scripture/audience"));
    send(
      {
        ...postMessage.mock.calls.at(-1)![0],
        type: "READY",
        instance: generation,
        sequence: 1,
        presentation,
        content,
      },
      target,
    );
    postMessage.mockClear();
    for (const tag of ["input", "textarea", "select", "div"]) {
      const element = document.createElement(tag);
      if (tag === "div") element.setAttribute("contenteditable", "true");
      document.body.append(element);
      expect(fireEvent.keyDown(element, { key: "ArrowDown" })).toBe(true);
      element.remove();
    }
    expect(
      fireEvent.keyDown(window, { key: "ArrowDown", isComposing: true }),
    ).toBe(true);
    expect(postMessage).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});

describe("projection audience transport", () => {
  it("binds commands to opener/document/generation, rejects replay and fails closed without late revival", () => {
    window.history.replaceState(null, "", `/#levi=${generation}`);
    const postMessage = vi.fn();
    const opener = { postMessage } as unknown as Window;
    vi.stubGlobal("opener", opener);
    const navigate = vi.fn();
    const invalidate = vi.fn();
    const isAuthorized = vi.fn(() => true);
    const { result, rerender } = renderHook(
      ({ authorized }) =>
        useProjectionAudience({
          kind: "slide",
          content: { page: 0 },
          ready: authorized,
          authorized,
          isAuthorized,
          navigate,
          invalidate,
        }),
      { initialProps: { authorized: true } },
    );
    const envelope = projectionEnvelope("slide", generation);
    send({ ...envelope, type: "CONNECT", challenge: second }, opener);
    const ready = postMessage.mock.calls.at(-1)![0];
    expect(ready).toMatchObject({
      type: "READY",
      challenge: second,
      presentation,
    });
    const command = {
      ...envelope,
      type: "CONTROL",
      instance: ready.instance,
      sequence: 1,
      command: { action: "toggle-blank" },
    };
    for (const patch of [
      { generation: second },
      { instance: second },
      { kind: "scripture" },
      { version: 1 },
      { extra: true },
    ])
      send({ ...command, ...patch }, opener);
    send(command, {} as Window);
    send(command, opener, "https://foreign.example");
    expect(result.current.blank).toBe(false);
    send(command, opener);
    expect(result.current.blank).toBe(true);
    send(command, opener);
    expect(result.current.blank).toBe(true);
    send(
      { ...command, sequence: 2, command: { action: "select-page", page: -1 } },
      opener,
    );
    expect(navigate).not.toHaveBeenCalled();
    send(
      { ...command, sequence: 2, command: { action: "select-page", page: 3 } },
      opener,
    );
    expect(navigate).toHaveBeenCalledWith({ action: "select-page", page: 3 });
    isAuthorized.mockReturnValue(false);
    rerender({ authorized: false });
    send({ ...command, sequence: 3, command: { action: "next" } }, opener);
    expect(navigate).toHaveBeenCalledTimes(1);
    send({ ...envelope, type: "CONNECT", challenge: second }, opener);
    expect(postMessage.mock.calls.at(-1)![0].presentation).toMatchObject({
      ready: false,
      authorized: false,
    });
  });
});
