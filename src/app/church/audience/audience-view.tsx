import type { CSSProperties, RefObject } from "react";
import type { ScriptureSearchItem } from "@/domain/scripture/search";
import type { AudienceStatus } from "./use-audience-data";

function heading(item: ScriptureSearchItem) {
  const bookName =
    item.texts.japanese?.bookName ??
    item.texts.english?.bookName ??
    item.location.book;
  return `新改訳聖書第3版 ${bookName} ${item.location.chapter}:${item.location.verse}`;
}

export function AudienceView({
  blank,
  current,
  fontScale,
  message,
  screenRef,
  status,
  verseRef,
}: {
  blank: boolean;
  current: ScriptureSearchItem | null;
  fontScale: number;
  message: string;
  screenRef: RefObject<HTMLElement | null>;
  status: AudienceStatus;
  verseRef: RefObject<HTMLDivElement | null>;
}) {
  if (status !== "ready" || !current)
    return (
      <main className="audience-screen audience-waiting">
        <p role={status === "error" ? "alert" : "status"}>
          {status === "loading"
            ? "投影する御言葉を読み込んでいます。"
            : message}
        </p>
      </main>
    );

  const translations = [
    ...(current.texts.japanese
      ? [{ language: "ja" as const, text: current.texts.japanese.text }]
      : []),
    ...(current.texts.english
      ? [{ language: "en" as const, text: current.texts.english.text }]
      : []),
  ];

  return (
    <main
      aria-label={blank ? "空白投影" : undefined}
      className={`audience-screen${blank ? " audience-blank" : ""}`}
      ref={screenRef}
      style={
        {
          "--audience-fit-scale": 1,
          "--audience-scale": fontScale,
        } as CSSProperties
      }
    >
      {blank ? null : (
        <>
          <h1 className="audience-book-name">{heading(current)}</h1>
          <article className="audience-content">
            <div className="audience-verse" ref={verseRef}>
              {translations.map((translation) => (
                <p
                  className="audience-book-word audience-shadow"
                  key={translation.language}
                  lang={translation.language}
                >
                  <span className="audience-verse-number">
                    {current.location.verse}:
                  </span>{" "}
                  {translation.text}
                </p>
              ))}
            </div>
          </article>
          {message ? (
            <p className="audience-navigation-error">{message}</p>
          ) : null}
        </>
      )}
    </main>
  );
}
