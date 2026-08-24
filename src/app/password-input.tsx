"use client";

import { type InputHTMLAttributes, type ReactNode, useState } from "react";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  id: string;
  label: string;
  toggleLabel?: string;
};

export function PasswordInput({
  id,
  label,
  toggleLabel = label,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const actionLabel = `${toggleLabel}を${visible ? "隠す" : "表示"}`;

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input {...inputProps} id={id} type={visible ? "text" : "password"} />
        <button
          aria-label={actionLabel}
          aria-pressed={visible}
          className="password-visibility-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <PasswordVisibilityIcon visible={visible} />
        </button>
      </div>
    </>
  );
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }): ReactNode {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      {visible ? (
        <path
          d="m4 4 16 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
}
