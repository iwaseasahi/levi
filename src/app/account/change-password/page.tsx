import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ChurchSidebarWorkspace } from "@/app/church/church-sidebar-workspace";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { AccountChangePasswordForm } from "./account-change-password-form";

export default async function AccountChangePasswordPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");

  return (
    <ChurchSidebarWorkspace>
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="change-password-title">
          <p className="eyebrow">Levi</p>
          <h1 id="change-password-title">パスワードを変更</h1>
          <AccountChangePasswordForm />
        </section>
      </main>
    </ChurchSidebarWorkspace>
  );
}
