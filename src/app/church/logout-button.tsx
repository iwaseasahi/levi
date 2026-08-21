"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/infrastructure/auth/client";
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className="secondary-button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
        } finally {
          router.replace("/login");
        }
      }}
      type="button"
    >
      {pending ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
