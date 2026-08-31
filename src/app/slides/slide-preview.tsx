"use client";

import { useId, useState } from "react";
import { slideOutline } from "@/domain/slides/slide";
import { SlideText } from "./slide-text";

export function SlidePreview({ pages }: { pages: string[] }) {
  const [page, setPage] = useState(0);
  const id = useId();
  return (
    <section aria-label="本文プレビュー" className="slide-preview">
      <SlideText text={pages[page] ?? ""} />
      <div className="slide-actions">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          前のページ
        </button>
        <p role="status">
          {page + 1} / {pages.length}
        </p>
        <button
          type="button"
          disabled={page === pages.length - 1}
          onClick={() => setPage(page + 1)}
        >
          次のページ
        </button>
      </div>
      <label htmlFor={id}>ページを選択</label>
      <select
        id={id}
        value={page}
        onChange={(event) => setPage(Number(event.target.value))}
      >
        {slideOutline(pages).map((label, index) => (
          <option key={index} value={index}>
            {index + 1}. {Array.from(label).slice(0, 80).join("")}
          </option>
        ))}
      </select>
    </section>
  );
}
