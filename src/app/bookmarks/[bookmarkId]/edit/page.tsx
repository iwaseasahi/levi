import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookmarkEditPanel } from "@/app/church/bookmark-edit-panel";
import { getChurchAccess } from "@/infrastructure/auth/church-session";

export default async function BookmarkEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookmarkId: string }>;
  searchParams: Promise<{ folderId?: string }>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  const [{ bookmarkId }, query] = await Promise.all([params, searchParams]);
  if (!query.folderId) notFound();
  return (
    <BookmarkEditPanel bookmarkId={bookmarkId} folderId={query.folderId} />
  );
}
