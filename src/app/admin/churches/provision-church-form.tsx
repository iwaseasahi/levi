"use client";

import { useActionState, useEffect, useRef } from "react";

import type { ProvisionChurchFormState } from "@/application/admin/provision-church-controller";

const initialProvisionChurchFormState: ProvisionChurchFormState = {
  status: "idle",
};

type ProvisionChurchAction = (
  previousState: ProvisionChurchFormState,
  formData: FormData,
) => Promise<ProvisionChurchFormState>;

function FieldErrors({
  errors,
  id,
}: {
  errors: string[] | undefined;
  id: string;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <ul className="field-errors" id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function ProvisionChurchForm({
  action,
}: {
  action: ProvisionChurchAction;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialProvisionChurchFormState,
  );
  const feedbackRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    feedbackRef.current?.focus();
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  const validationErrors =
    state.status === "validation-error" ? state.fieldErrors : {};
  const showSuccess = state.status === "success" && !pending;

  return (
    <div className="provisioning-grid">
      <form action={formAction} className="admin-form" ref={formRef}>
        <fieldset disabled={pending}>
          <legend className="sr-only">教会と初期アカウントの情報</legend>

          <label htmlFor="church-name">教会名</label>
          <input
            aria-describedby={
              validationErrors.churchName ? "church-name-errors" : undefined
            }
            aria-invalid={Boolean(validationErrors.churchName)}
            autoComplete="organization"
            id="church-name"
            maxLength={200}
            name="churchName"
            required
          />
          <FieldErrors
            errors={validationErrors.churchName}
            id="church-name-errors"
          />

          <label htmlFor="account-name">利用者名</label>
          <input
            aria-describedby={
              validationErrors.accountName ? "account-name-errors" : undefined
            }
            aria-invalid={Boolean(validationErrors.accountName)}
            autoComplete="name"
            id="account-name"
            maxLength={200}
            name="accountName"
            required
          />
          <FieldErrors
            errors={validationErrors.accountName}
            id="account-name-errors"
          />

          <label htmlFor="account-email">ログイン用メールアドレス</label>
          <input
            aria-describedby={
              validationErrors.email ? "account-email-errors" : undefined
            }
            aria-invalid={Boolean(validationErrors.email)}
            autoCapitalize="none"
            autoComplete="email"
            id="account-email"
            maxLength={320}
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          <FieldErrors
            errors={validationErrors.email}
            id="account-email-errors"
          />

          <button className="primary-button" type="submit">
            {pending ? "作成中…" : "教会と初期アカウントを作成"}
          </button>
        </fieldset>
      </form>

      <div className="provisioning-feedback" aria-live="polite">
        {pending ? (
          <div className="notice" role="status">
            教会とアカウントを安全に作成しています。
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
            <h2>作成を完了できませんでした</h2>
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
            <p className="eyebrow">メール招待</p>
            <h2>{state.message}</h2>
            <dl className="credential-summary">
              <div>
                <dt>教会</dt>
                <dd>{state.churchName}</dd>
              </div>
              <div>
                <dt>ログイン用メールアドレス</dt>
                <dd>{state.email}</dd>
              </div>
            </dl>
            <p>メール内のパスワード設定リンクは24時間有効です。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
