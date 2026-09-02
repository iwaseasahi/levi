import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { AccountChangeEmailForm } from "./account-change-email-form";

interface PageProps {
  searchParams: Promise<{ completed?: string; error?: string }>;
}

export default async function AccountChangeEmailPage({
  searchParams,
}: PageProps) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");

  const result = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="change-email-title">
        <p className="eyebrow">Levi</p>
        <h1 id="change-email-title">メールアドレスを変更</h1>
        {result.completed === "1" ? (
          <div className="notice notice-success" role="status">
            <p>ログイン用メールアドレスを変更しました。</p>
            <Link href="/scripture">聖書検索へ戻る</Link>
          </div>
        ) : result.error ? (
          <>
            <div className="notice notice-error" role="alert">
              <p>
                確認リンクを使用できませんでした。もう一度変更を申請してください。
              </p>
            </div>
            <AccountChangeEmailForm />
          </>
        ) : (
          <AccountChangeEmailForm />
        )}
      </section>
    </main>
  );
}
