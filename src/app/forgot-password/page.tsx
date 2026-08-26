import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="reset-title">
        <p className="eyebrow">Levi</p>
        <h1 id="reset-title">パスワードを再設定</h1>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
