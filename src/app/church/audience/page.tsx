import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { AudienceDisplay } from "./audience-display";

export default async function AudiencePage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  return <AudienceDisplay />;
}
