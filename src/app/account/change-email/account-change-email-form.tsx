"use client";

import Link from "next/link";
import { useState } from "react";

import { PasswordInput } from "@/app/password-input";
import { ClientApiError, postJson } from "@/app/church/client-api";

export function AccountChangeEmailForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    const newEmail = String(formData.get("newEmail") ?? "")
      .trim()
      .toLowerCase();
    const confirmation = String(formData.get("confirmation") ?? "")
      .trim()
      .toLowerCase();
    if (newEmail !== confirmation) {
      setMessage("確認用メールアドレスが一致しません。");
      return;
    }

    setPending(true);
    setMessage(undefined);
    try {
      await postJson(
        fetch,
        "/api/account/change-email",
        {
          confirmation,
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newEmail,
        },
        "メールアドレスの変更を受け付けられませんでした。",
      );
      setSent(true);
    } catch (error) {
      setMessage(
        error instanceof ClientApiError && error.status === 429
          ? "試行回数が上限に達しました。時間を置いてお試しください。"
          : "現在のパスワードとメールアドレスを確認して、もう一度お試しください。",
      );
    } finally {
      setPending(false);
    }
  }

  if (sent)
    return (
      <div className="notice notice-success" role="status">
        <p>
          確認メールを送信しました。メール内のリンクを開くまで、現在のメールアドレスでログインできます。
        </p>
        <Link href="/scripture">聖書検索へ戻る</Link>
      </div>
    );

  return (
    <form action={submit} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">メールアドレス変更</legend>
        <PasswordInput
          autoComplete="current-password"
          id="email-change-current-password"
          label="現在のパスワード"
          maxLength={128}
          name="currentPassword"
          required
        />
        <label htmlFor="email-change-new-email">新しいメールアドレス</label>
        <input
          autoCapitalize="none"
          autoComplete="email"
          id="email-change-new-email"
          maxLength={320}
          name="newEmail"
          required
          type="email"
        />
        <label htmlFor="email-change-confirmation">
          新しいメールアドレス（確認）
        </label>
        <input
          autoCapitalize="none"
          autoComplete="email"
          id="email-change-confirmation"
          maxLength={320}
          name="confirmation"
          required
          type="email"
        />
        <button className="primary-button" type="submit">
          {pending ? "送信中…" : "確認メールを送信"}
        </button>
      </fieldset>
      {message ? (
        <div className="notice notice-error" role="alert">
          {message}
        </div>
      ) : null}
      <Link className="auth-form-footer-link" href="/scripture">
        聖書検索へ戻る
      </Link>
    </form>
  );
}
