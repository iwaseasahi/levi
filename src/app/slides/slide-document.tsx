"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import type { SlideRecord } from "@/domain/slides/commands";
import { parseSlideBody } from "@/domain/slides/slide";
import { SlideEditor } from "./slide-editor";
import { SlideError, slideErrorMessage } from "./slide-error";
import { SlidePreview } from "./slide-preview";
import { SlideController } from "./slide-controller";

export function SlideDocument({
  id,
  editing = false,
  fetcher: providedFetcher = fetch,
}: {
  id: string;
  editing?: boolean;
  fetcher?: typeof fetch;
}) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const [slide, setSlide] = useState<SlideRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void requestJson<{ slide: SlideRecord }>(
      fetcher,
      `/api/church/slides/${id}`,
      { cache: "no-store" },
      "SLIDE_UNAVAILABLE",
    )
      .then((result) => {
        if (current) setSlide(result.slide);
      })
      .catch((cause: unknown) => {
        if (current) setError(slideErrorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [id, fetcher, attempt]);
  if (error)
    return (
      <>
        <SlideError message={error} />
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAttempt(attempt + 1);
          }}
        >
          再試行
        </button>
      </>
    );
  if (!slide) return <p role="status">読み込み中…</p>;
  if (editing) return <SlideEditor initial={slide} fetcher={fetcher} />;
  return (
    <>
      <h1>{slide.title}</h1>
      {slide.author && <p>著者: {slide.author}</p>}
      <p>保存済み · リビジョン {slide.revision}</p>
      <Link href={`/slides/${slide.id}/edit`}>編集</Link>
      <SlideController slide={slide} />
      <SlidePreview text={parseSlideBody(slide.body)} />
    </>
  );
}
