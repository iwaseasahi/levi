import { AdminResetPasswordForm } from "./admin-reset-password-form";

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="admin-new-password-title">
        <p className="eyebrow">Levi administration</p>
        <h1 id="admin-new-password-title">新しいパスワードを設定</h1>
        <AdminResetPasswordForm {...(token ? { token } : {})} />
      </section>
    </main>
  );
}
