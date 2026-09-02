"use client";

import Link from "next/link";
import { useState } from "react";

import { PasswordInput } from "@/app/password-input";
import { authClient } from "@/infrastructure/auth/client";

export function AccountChangePasswordForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== String(formData.get("confirmation") ?? "")) {
      setMessage("確認用パスワードが一致しません。");
      return;
    }
    setPending(true);
    setMessage(undefined);
    const result = await authClient.changePassword({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setMessage("現在のパスワードを確認して、もう一度お試しください。");
      return;
    }
    setSuccess(true);
  }

  if (success)
    return (
      <div className="notice notice-success" role="status">
        <p>パスワードを変更しました。</p>
        <Link href="/scripture">聖書検索へ戻る</Link>
      </div>
    );

  return (
    <form action={submit} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">パスワード変更</legend>
        <PasswordInput
          autoComplete="current-password"
          id="current-password"
          label="現在のパスワード"
          name="currentPassword"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          id="account-new-password"
          label="新しいパスワード"
          maxLength={128}
          minLength={12}
          name="newPassword"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          id="account-new-password-confirmation"
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
      <Link className="auth-form-return-link" href="/scripture">
        聖書検索へ戻る
      </Link>
    </form>
  );
}
