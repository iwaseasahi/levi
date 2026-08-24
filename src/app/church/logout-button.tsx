"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/infrastructure/auth/client";
export function LogoutButton({
  className = "secondary-button",
  role,
}: {
  className?: string;
  role?: "menuitem";
} = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className={className}
      disabled={pending}
      role={role}
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
