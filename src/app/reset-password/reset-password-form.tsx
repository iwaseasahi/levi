"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordInput } from "@/app/password-input";
import { authClient } from "@/infrastructure/auth/client";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (!token)
    return (
      <div className="notice notice-error" role="alert">
        <p>再設定リンクが無効です。新しいメールを送信してください。</p>
        <Link href="/forgot-password">再設定メールを送信</Link>
      </div>
    );

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    if (password !== String(formData.get("confirmation") ?? "")) {
      setMessage("確認用パスワードが一致しません。");
      return;
    }
    setPending(true);
    setMessage(undefined);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (result.error) {
      setPending(false);
      setMessage("再設定リンクが無効または期限切れです。");
      return;
    }
    router.replace("/login?passwordReset=completed");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">新しいパスワード</legend>
        <PasswordInput
          autoComplete="new-password"
          id="new-password"
          label="新しいパスワード"
          maxLength={128}
          minLength={12}
          name="password"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          id="new-password-confirmation"
          label="新しいパスワード（確認）"
          maxLength={128}
          minLength={12}
          name="confirmation"
          required
        />
        <button className="primary-button" type="submit">
          {pending ? "変更中…" : "パスワードを変更"}
        </button>
      </fieldset>
      {message ? (
        <div className="notice notice-error" role="alert">
          {message}
        </div>
      ) : null}
    </form>
  );
}
