import { redirect } from "next/navigation";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function ChurchAdministrationPage() {
  await requireAdminPageAccess();
  redirect("/admin/churches/new");
}
