"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/app/password-input";
import { adminAuthClient } from "@/infrastructure/auth/admin-client";

export function AdminResetPasswordForm({ token }: { token?: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (!token)
    return (
      <div className="notice notice-error" role="alert">
        <p>再設定リンクが無効です。新しいメールを送信してください。</p>
        <Link href="/admin/forgot-password">再設定メールを送信</Link>
      </div>
    );

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password !== confirmation) {
      setMessage("確認用パスワードが一致しません。");
      return;
    }
    setPending(true);
    setMessage(undefined);
    const result = await adminAuthClient.resetPassword({
      newPassword: password,
      token,
    });
    if (result.error) {
      setPending(false);
      setMessage("再設定リンクが無効または期限切れです。");
      return;
    }
    router.replace("/admin/login?passwordReset=completed");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">新しい管理者パスワード</legend>
        <PasswordInput
          autoComplete="new-password"
          id="admin-new-password"
          label="新しいパスワード"
          maxLength={128}
          minLength={12}
          name="password"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          id="admin-new-password-confirmation"
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
