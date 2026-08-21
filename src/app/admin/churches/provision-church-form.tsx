"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
  const [secretDismissed, setSecretDismissed] = useState(false);
  const [secretRevealed, setSecretRevealed] = useState(false);
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
  const showSuccess =
    state.status === "success" && !pending && !secretDismissed;

  return (
    <div className="provisioning-grid">
      <form
        action={formAction}
        className="admin-form"
        onSubmit={() => {
          setSecretDismissed(false);
          setSecretRevealed(false);
        }}
        ref={formRef}
      >
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
            <p className="eyebrow">一度だけ表示されます</p>
            <h2>{state.message}</h2>
            <dl className="credential-summary">
              <div>
                <dt>教会</dt>
                <dd>{state.churchName}</dd>
              </div>
              <div>
                <dt>ログインID</dt>
                <dd>{state.email}</dd>
              </div>
              <div>
                <dt>一時パスワード</dt>
                <dd>
                  {secretRevealed ? (
                    <code>{state.temporaryPassword}</code>
                  ) : (
                    <button
                      className="inline-button"
                      onClick={() => setSecretRevealed(true)}
                      type="button"
                    >
                      一時パスワードを表示
                    </button>
                  )}
                </dd>
              </div>
            </dl>
            <p>
              今この場で、本人確認済みの対面または通話により伝えてください。
              メール、チャット、Issue、画面保存には残さないでください。
            </p>
            <button
              className="secondary-button"
              onClick={() => setSecretDismissed(true)}
              type="button"
            >
              表示を閉じる
            </button>
          </div>
        ) : null}

        {state.status === "success" && !pending && secretDismissed ? (
          <div className="notice" ref={feedbackRef} tabIndex={-1}>
            一時パスワードの表示を終了しました。再表示はできません。
          </div>
        ) : null}
      </div>
    </div>
  );
}
