import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authenticateAdminBasic } from "@/infrastructure/auth/admin-basic-auth";
import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { AdminChangePasswordForm } from "../admin-change-password-form";
import { adminChangePasswordAction, adminLogoutAction } from "../auth-actions";

export default async function AdminChangePasswordPage() {
  const requestHeaders = await headers();
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  const session = await getAdminSessionAccess(requestHeaders);
  if (basic.status !== "authorized" || session.status !== "authorized")
    redirect("/admin/login");
  if (!session.mustChangePassword) redirect("/admin");
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="admin-password-title">
        <p className="eyebrow">Levi administration</p>
        <h1 id="admin-password-title">パスワードの変更</h1>
        <AdminChangePasswordForm action={adminChangePasswordAction} />
        <form action={adminLogoutAction}>
          <button className="secondary-button admin-auth-logout" type="submit">
            ログアウト
          </button>
        </form>
      </section>
    </main>
  );
}
