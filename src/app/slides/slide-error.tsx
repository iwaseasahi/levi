"use client";

import { useEffect, useRef } from "react";
import { ClientApiError } from "@/app/church/client-api";
import { SlideInputError } from "@/domain/slides/slide";

export function slideErrorMessage(error: unknown) {
  if (error instanceof SlideInputError)
    return "タイトルは1〜200文字の1行、本文は空白以外を含む1〜100,000文字で入力してください。";
  if (error instanceof ClientApiError) {
    if (error.code === "SLIDE_IMAGE_QUOTA_EXCEEDED")
      return "教会で保存できる画像容量の上限に達しました。不要な画像スライドを削除してから再度お試しください。";
    if (error.status === 409)
      return "別の編集が保存されています。入力は保持しています。内容を控えてから再度開いてください。";
    if (error.status === 401 || error.status === 403)
      return "利用資格を確認できません。ログインし直してください。";
    if (error.status === 404)
      return "スライドが見つかりません。削除された可能性があります。";
  }
  return "スライドを読み込み・保存できませんでした。入力を保持しています。再度お試しください。";
}

export function SlideError({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [message]);
  return (
    <p className="slide-error" role="alert" tabIndex={-1} ref={ref}>
      {message}
    </p>
  );
}
