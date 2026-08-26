import { AdminForgotPasswordForm } from "./admin-forgot-password-form";

export default function AdminForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="admin-reset-title">
        <p className="eyebrow">Levi administration</p>
        <h1 id="admin-reset-title">パスワードを再設定</h1>
        <AdminForgotPasswordForm />
      </section>
    </main>
  );
}
