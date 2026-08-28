"use client";

import { useActionState, useEffect, useRef } from "react";

import type { InviteChurchUserFormState } from "@/application/admin/invite-church-user-controller";

type Action = (
  previousState: InviteChurchUserFormState,
  formData: FormData,
) => Promise<InviteChurchUserFormState>;

function FieldErrors({
  errors,
  id,
}: {
  errors: string[] | undefined;
  id: string;
}) {
  return errors?.length ? (
    <ul className="field-errors" id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  ) : null;
}

export function InviteChurchUserForm({
  action,
  churchId,
  churchName,
}: {
  action: Action;
  churchId: string;
  churchName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  } as InviteChurchUserFormState);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    feedbackRef.current?.focus();
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const errors = state.status === "validation-error" ? state.fieldErrors : {};

  return (
    <div className="provisioning-grid">
      <form action={formAction} className="admin-form" ref={formRef}>
        <fieldset disabled={pending}>
          <legend className="sr-only">追加する教会利用者の情報</legend>
          <input name="churchId" type="hidden" value={churchId} />

          <label htmlFor="invited-account-name">利用者名</label>
          <input
            aria-describedby={
              errors.accountName ? "invited-account-name-errors" : undefined
            }
            aria-invalid={Boolean(errors.accountName)}
            autoComplete="name"
            id="invited-account-name"
            maxLength={200}
            name="accountName"
            required
          />
          <FieldErrors
            errors={errors.accountName}
            id="invited-account-name-errors"
          />

          <label htmlFor="invited-account-email">
            ログイン用メールアドレス
          </label>
          <input
            aria-describedby={
              errors.email ? "invited-account-email-errors" : undefined
            }
            aria-invalid={Boolean(errors.email)}
            autoCapitalize="none"
            autoComplete="email"
            id="invited-account-email"
            maxLength={320}
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          <FieldErrors
            errors={errors.email}
            id="invited-account-email-errors"
          />

          <button className="primary-button" type="submit">
            {pending ? "招待中…" : "利用者を招待"}
          </button>
        </fieldset>
      </form>

      <div className="provisioning-feedback" aria-live="polite">
        {pending ? (
          <div className="notice" role="status">
            利用者を安全に招待しています。
          </div>
        ) : null}
        {state.status === "validation-error" ||
        state.status === "server-error" ||
        state.status === "not-authorized" ? (
          <div
            className="notice notice-error"
            ref={feedbackRef}
            role="alert"
            tabIndex={-1}
          >
            <h2>招待を完了できませんでした</h2>
            <p>{state.message}</p>
          </div>
        ) : null}
        {state.status === "success" ? (
          <div
            className="notice notice-success"
            ref={feedbackRef}
            role="status"
            tabIndex={-1}
          >
            <p className="eyebrow">メール招待</p>
            <h2>{state.message}</h2>
            <p>
              {churchName} / {state.email}
            </p>
            <p>メール内のパスワード設定リンクは24時間有効です。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
