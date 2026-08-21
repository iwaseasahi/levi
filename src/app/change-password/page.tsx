import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/app/church/logout-button";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
export default async function ChangePasswordPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (!access.mustChangePassword) redirect("/church");
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">初回ログイン</p>
        <h1>パスワードの変更が必要です</h1>
        <p>
          パスワード変更機能は Issue #45
          で実装します。それまでは教会用機能を利用できません。
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
