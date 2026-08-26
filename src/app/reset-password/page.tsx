import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="new-password-title">
        <p className="eyebrow">Levi</p>
        <h1 id="new-password-title">新しいパスワードを設定</h1>
        <ResetPasswordForm {...(token ? { token } : {})} />
      </section>
    </main>
  );
}
