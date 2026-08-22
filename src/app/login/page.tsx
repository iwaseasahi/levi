import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "authorized")
    redirect(access.mustChangePassword ? "/change-password" : "/scripture");
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Levi</p>
        <h1 id="login-title">ログイン</h1>
        <p>教会に登録されたメールアドレスでログインしてください。</p>
        <LoginForm />
      </section>
    </main>
  );
}
