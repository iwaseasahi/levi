import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { AdminLoginForm } from "../admin-login-form";
import { adminLoginAction } from "../auth-actions";

export default async function AdminLoginPage() {
  const session = await getAdminSessionAccess(await headers());
  if (session.status === "authorized")
    redirect(session.mustChangePassword ? "/admin/change-password" : "/admin");
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="admin-login-title">
        <p className="eyebrow">Levi administration</p>
        <h1 id="admin-login-title">管理者ログイン</h1>
        <AdminLoginForm action={adminLoginAction} />
      </section>
    </main>
  );
}
