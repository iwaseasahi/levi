import { headers } from "next/headers";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import {
  parseSlideProjectionQuery,
  slideAudienceMessages,
} from "@/domain/slides/projection";
import { SlideAudience } from "@/app/slides/slide-audience";

export default async function SlideAudiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status !== "authorized" || access.mustChangePassword)
    return (
      <main className="slide-audience">
        <p role="alert">{slideAudienceMessages.unavailable}</p>
      </main>
    );
  let query;
  try {
    query = parseSlideProjectionQuery(await searchParams);
  } catch {
    return (
      <main className="slide-audience">
        <p role="alert">{slideAudienceMessages.invalid}</p>
      </main>
    );
  }
  return (
    <SlideAudience
      key={`${query.id}:${query.page}`}
      id={query.id}
      page={query.page}
    />
  );
}
