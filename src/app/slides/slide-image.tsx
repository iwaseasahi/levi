"use client";

import { useState } from "react";

export function SlideImage({
  src,
  title,
  blank = false,
}: {
  src: string;
  title: string;
  blank?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <div className="slide-image-frame">
      {blank ? null : !failed ? (
        // Authenticated bytes use a same-origin route, not public image hosting.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={title} src={src} onError={() => setFailedSrc(src)} />
      ) : (
        <p role="alert">画像を表示できません。</p>
      )}
    </div>
  );
}
