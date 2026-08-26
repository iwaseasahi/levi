"use client";

import Link from "next/link";
import { useState } from "react";

import { authClient } from "@/infrastructure/auth/client";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    await authClient.requestPasswordReset({
      email: String(formData.get("email") ?? "")
        .trim()
        .toLowerCase(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    setSent(true);
  }

  if (sent)
    return (
      <div className="notice notice-success" role="status">
        <p>登録済みのメールアドレスであれば、再設定メールを送信しました。</p>
        <Link href="/login">ログインへ戻る</Link>
      </div>
    );

  return (
    <form action={submit} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">パスワード再設定</legend>
        <label htmlFor="reset-email">メールアドレス</label>
        <input
          autoCapitalize="none"
          autoComplete="email"
          id="reset-email"
          name="email"
          required
          type="email"
        />
        <button className="primary-button" type="submit">
          {pending ? "送信中…" : "再設定メールを送信"}
        </button>
      </fieldset>
      <Link href="/login">ログインへ戻る</Link>
    </form>
  );
}
