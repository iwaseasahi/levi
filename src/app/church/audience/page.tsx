import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { AudienceDisplay } from "./audience-display";
import { DirectAudienceDisplay } from "./direct-audience-display";

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  const raw = await searchParams;
  if (Object.keys(raw).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value))
        value.forEach((item) => params.append(key, item));
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
  return <AudienceDisplay />;
}
