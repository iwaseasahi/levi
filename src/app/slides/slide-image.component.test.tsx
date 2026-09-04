import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageSlideRecord } from "@/domain/slides/commands";
import { SlideAudience } from "./slide-audience";
import { SlideController } from "./slide-controller";
import { SlideDocument } from "./slide-document";
import { SlideEditor } from "./slide-editor";

const { push, replace, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

const id = "00000000-0000-4000-8000-000000000470";
const slide: ImageSlideRecord = {
  id,
  title: "投影画像",
  body: null,
  contentType: "image",
  image: {
    mediaType: "image/png",
    byteSize: 3,
    width: 1,
    height: 1,
  },
  revision: 1,
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
};

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  replace.mockClear();
  refresh.mockClear();
  vi.stubGlobal("URL", URL);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-image");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

describe("image Slide UI", () => {
  it("previews and submits one image as multipart", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ slide }, { status: 201 }),
    );
    const user = userEvent.setup();
    render(<SlideEditor fetcher={fetcher} />);
    await user.click(screen.getByRole("radio", { name: "画像" }));
    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: " 投影画像 " },
    });
    const file = new File([new Uint8Array([1, 2, 3])], "private.png", {
      type: "image/png",
    });
    await user.upload(
      document.querySelector<HTMLInputElement>("#slide-image")!,
      file,
    );
    await user.click(screen.getByRole("button", { name: "保存前プレビュー" }));
    expect(
      await screen.findByRole("img", { name: "投影画像" }),
    ).toHaveAttribute("src", "blob:synthetic-image");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const request = fetcher.mock.calls[0]![1]!;
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ Accept: "application/json" });
    expect(request.body).toBeInstanceOf(FormData);
    const form = request.body as FormData;
    expect(form.get("title")).toBe("投影画像");
    expect(form.get("image")).toBe(file);
    expect(form.has("body")).toBe(false);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/slides/${id}`));
  });

  it("renames an existing image without downloading or re-uploading bytes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ slide: { ...slide, title: "Renamed", revision: 2 } }),
    );
    render(<SlideEditor initial={slide} fetcher={fetcher} />);
    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "Renamed" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(fetcher).toHaveBeenCalledWith(`/api/church/slides/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        input: { contentType: "image", title: "Renamed" },
        expectedRevision: 1,
      }),
    });
  });

  it("requires confirmation before replacing saved image bytes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ slide: { ...slide, revision: 2 } }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SlideEditor initial={slide} fetcher={fetcher} />);
    await userEvent.upload(
      document.querySelector<HTMLInputElement>("#slide-image")!,
      new File([new Uint8Array([4, 5, 6])], "replacement.png", {
        type: "image/png",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("renders authenticated detail bytes and hides text-only controls", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ slide }));
    render(<SlideDocument id={id} fetcher={fetcher} />);
    const image = await screen.findByRole("img", { name: slide.title });
    expect(image).toHaveAttribute(
      "src",
      `/api/church/slides/${id}/image?revision=1`,
    );
    expect(
      screen.queryByRole("button", { name: "文字を大きく" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "空白と表示を切り替え" }),
    ).toBeDisabled();
  });

  it("projects an image and clears it after revision revalidation", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ slide }));
    render(<SlideAudience id={id} fetcher={fetcher} />);
    expect(
      await screen.findByRole("img", { name: slide.title }),
    ).toHaveAttribute("src", `/api/church/slides/${id}/image?revision=1`);
    fetcher.mockImplementation(async () =>
      Response.json({ slide: { ...slide, revision: 2 } }),
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "更新されました",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("turns an image decode failure into an accessible error", async () => {
    render(<SlideController slide={slide} />);
    expect(screen.queryByLabelText("文字を大きく")).not.toBeInTheDocument();
    render(
      <SlideDocument id={id} fetcher={async () => Response.json({ slide })} />,
    );
    const image = await screen.findAllByRole("img", { name: slide.title });
    fireEvent.error(image.at(-1)!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "画像を表示できません",
    );
  });
});
