import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { AdminLoginForm } from "../admin-login-form";

export default async function AdminLoginPage() {
  const session = await getAdminSessionAccess(await headers());
  if (session.status === "authorized") redirect("/admin");
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="admin-login-title">
        <p className="eyebrow">Levi administration</p>
        <h1 id="admin-login-title">管理者ログイン</h1>
        <AdminLoginForm />
        <Link href="/admin/forgot-password">パスワードを忘れた場合</Link>
      </section>
    </main>
  );
}
