"use client";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/app/password-input";
import { authClient } from "@/infrastructure/auth/client";

const genericError =
  "ログインできませんでした。メールアドレスとパスワードを確認してください。";
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(data.get("email") ?? "")
          .trim()
          .toLowerCase(),
        password: String(data.get("password") ?? ""),
        rememberMe: true,
      });
      if (result.error) throw new Error("rejected");
      router.replace("/scripture");
    } catch {
      setError(genericError);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend className="sr-only">ログイン情報</legend>
        <label htmlFor="login-email">メールアドレス</label>
        <input
          autoComplete="username"
          id="login-email"
          name="email"
          required
          type="email"
        />
        <PasswordInput
          autoComplete="current-password"
          id="login-password"
          label="パスワード"
          name="password"
          required
        />
        <button className="primary-button" type="submit">
          {pending ? "ログイン中…" : "ログイン"}
        </button>
      </fieldset>
      <Link href="/forgot-password">パスワードを忘れた場合</Link>
      {error ? (
        <div
          className="notice notice-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
