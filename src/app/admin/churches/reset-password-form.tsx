"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ResetPasswordState } from "./reset-actions";

export function ResetPasswordForm({
  action,
  churches,
}: {
  action: (
    state: ResetPasswordState,
    formData: FormData,
  ) => Promise<ResetPasswordState>;
  churches: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  } as ResetPasswordState);
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") feedback.current?.focus();
  }, [state]);
  const showSecret = state.status === "success" && !dismissed;
  return (
    <section className="admin-form">
      <h2>教会アカウントのパスワード再設定</h2>
      <form
        action={formAction}
        onSubmit={() => {
          setRevealed(false);
          setDismissed(false);
        }}
      >
        <fieldset disabled={pending}>
          <label htmlFor="reset-church">対象教会</label>
          <select id="reset-church" name="churchId" required defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>
          <label className="confirmation">
            <input name="confirmed" type="checkbox" value="yes" required />
            既存セッションがすべて失効し、現在のパスワードが使えなくなることを確認しました
          </label>
          <button className="secondary-button" type="submit">
            {pending ? "再設定中…" : "パスワードを再設定"}
          </button>
        </fieldset>
      </form>
      {state.status === "error" ? (
        <div
          className="notice notice-error"
          ref={feedback}
          role="alert"
          tabIndex={-1}
        >
          {state.message}
        </div>
      ) : null}
      {showSecret ? (
        <div
          className="notice notice-success"
          ref={feedback}
          role="status"
          tabIndex={-1}
        >
          <p className="eyebrow">一度だけ表示されます</p>
          <h3>{state.message}</h3>
          <p>
            {state.churchName} / {state.email}
          </p>
          {revealed ? (
            <code>{state.temporaryPassword}</code>
          ) : (
            <button
              className="inline-button"
              onClick={() => setRevealed(true)}
              type="button"
            >
              一時パスワードを表示
            </button>
          )}
          <p>
            本人確認済みの対面または通話で伝えてください。メールやチャットでは送らないでください。
          </p>
          <button
            className="secondary-button"
            onClick={() => setDismissed(true)}
            type="button"
          >
            表示を閉じる
          </button>
        </div>
      ) : null}
      {state.status === "success" && dismissed ? (
        <div className="notice" ref={feedback} tabIndex={-1}>
          一時パスワードを破棄しました。再表示はできません。
        </div>
      ) : null}
    </section>
  );
}
