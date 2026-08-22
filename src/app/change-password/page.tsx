import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/app/church/logout-button";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { changePasswordAction } from "./actions";
import { ChangePasswordForm } from "./change-password-form";
export default async function ChangePasswordPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (!access.mustChangePassword) redirect("/scripture");
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">初回ログイン</p>
        <h1>パスワードの変更が必要です</h1>
        <p>
          一時パスワードを、本人だけが知る新しいパスワードへ変更してください。
        </p>
        <ChangePasswordForm action={changePasswordAction} />
        <LogoutButton />
      </section>
    </main>
  );
}
