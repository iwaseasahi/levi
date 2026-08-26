"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { InviteAdminUserFormState } from "@/application/admin/invite-admin-user-controller";

type Action = (
  state: InviteAdminUserFormState,
  formData: FormData,
) => Promise<InviteAdminUserFormState>;

function Errors({ errors, id }: { errors: string[] | undefined; id: string }) {
  return errors?.length ? (
    <ul className="field-errors" id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  ) : null;
}

export function InviteAdminUserForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [dismissed, setDismissed] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    feedbackRef.current?.focus();
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const errors = state.status === "validation-error" ? state.fieldErrors : {};
  const showSuccess = state.status === "success" && !pending && !dismissed;

  return (
    <div className="provisioning-grid">
      <form
        action={formAction}
        className="admin-form"
        onSubmit={() => {
          setDismissed(false);
        }}
        ref={formRef}
      >
        <fieldset disabled={pending}>
          <legend className="sr-only">招待する管理者の情報</legend>
          <label htmlFor="admin-name">管理者名</label>
          <input
            aria-describedby={errors.name ? "admin-name-errors" : undefined}
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            id="admin-name"
            maxLength={200}
            name="name"
            required
          />
          <Errors errors={errors.name} id="admin-name-errors" />

          <label htmlFor="admin-email">メールアドレス</label>
          <input
            aria-describedby={errors.email ? "admin-email-errors" : undefined}
            aria-invalid={Boolean(errors.email)}
            autoCapitalize="none"
            autoComplete="email"
            id="admin-email"
            name="email"
            required
            type="email"
          />
          <Errors errors={errors.email} id="admin-email-errors" />

          <button className="primary-button" type="submit">
            {pending ? "招待中…" : "管理者を招待"}
          </button>
        </fieldset>
      </form>

      <div className="provisioning-feedback" aria-live="polite">
        {pending ? (
          <div className="notice" role="status">
            管理者アカウントを安全に作成しています。
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
        {showSuccess ? (
          <div
            className="notice notice-success"
            ref={feedbackRef}
            role="status"
            tabIndex={-1}
          >
            <h2>{state.message}</h2>
            <dl className="credential-summary">
              <div>
                <dt>管理者名</dt>
                <dd>{state.name}</dd>
              </div>
              <div>
                <dt>メールアドレス</dt>
                <dd>{state.email}</dd>
              </div>
            </dl>
            <p>メール内のリンクは1時間有効です。</p>
            <button
              className="secondary-button"
              onClick={() => setDismissed(true)}
              type="button"
            >
              表示を閉じる
            </button>
          </div>
        ) : null}
        {state.status === "success" && !pending && dismissed ? (
          <div className="notice" ref={feedbackRef} tabIndex={-1}>
            招待メールを送信しました。
          </div>
        ) : null}
      </div>
    </div>
  );
}
