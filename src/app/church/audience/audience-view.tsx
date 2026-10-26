import type { CSSProperties, RefObject } from "react";
import type { ScriptureSearchItem } from "@/domain/scripture/search";
import type { AudienceStatus } from "./use-audience-data";

const JSS3_ATTRIBUTION = "聖書 新改訳 ©︎2003 日本聖書刊行会";

function references(item: ScriptureSearchItem) {
  const location = `${item.location.chapter}:${item.location.verse}`;
  const fallbackEnglishBook = item.location.book.replace(
    /[A-Z]+/g,
    (part) => `${part[0]}${part.slice(1).toLowerCase()}`,
  );
  return {
    english: item.texts.english?.bookName ?? null,
    fallback:
      !item.texts.japanese && !item.texts.english ? fallbackEnglishBook : null,
    japanese: item.texts.japanese?.bookName ?? null,
    location,
  };
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
  if (status === "loading")
    return <main className="audience-screen audience-waiting" />;

  if (status !== "ready" || !current)
    return (
      <main className="audience-screen audience-waiting">
        <p role={status === "error" ? "alert" : "status"}>{message}</p>
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
  const locationReferences = references(current);

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
          <header className="audience-header">
            <h1 className="audience-book-name">
              {locationReferences.japanese ? (
                <span lang="ja">{locationReferences.japanese}</span>
              ) : null}
              {locationReferences.japanese && locationReferences.english
                ? " / "
                : null}
              {locationReferences.english ? (
                <span lang="en">{locationReferences.english}</span>
              ) : null}
              {locationReferences.fallback} {locationReferences.location}
            </h1>
            <p className="audience-attribution" lang="ja">
              {JSS3_ATTRIBUTION}
            </p>
          </header>
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
