import { notFound } from "next/navigation";

import { DirectAudienceDisplay } from "@/app/church/audience/direct-audience-display";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireChurchPageAccess();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.append(key, value);
  }
  let selection;
  try {
    selection = parseScriptureSearch(params);
  } catch (error) {
    if (error instanceof ScriptureSearchError) notFound();
    throw error;
  }
  return <DirectAudienceDisplay selection={selection} />;
}
