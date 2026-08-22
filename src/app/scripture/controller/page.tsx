import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ProjectionController } from "@/app/church/projection/projection-controller";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { getChurchAccess } from "@/infrastructure/auth/church-session";

export default async function ScriptureControllerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");

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

  return <ProjectionController selection={selection} />;
}
