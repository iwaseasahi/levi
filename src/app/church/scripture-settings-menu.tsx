"use client";

import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./logout-button";

export function ScriptureSettingsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="scripture-settings" ref={containerRef}>
      {open ? (
        <div
          aria-label="設定メニュー"
          className="scripture-settings-menu"
          id="scripture-settings-menu"
          role="menu"
        >
          <LogoutButton className="scripture-settings-logout" role="menuitem" />
        </div>
      ) : null}
      <button
        aria-controls="scripture-settings-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="設定"
        className="scripture-settings-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9 3.5-.1-1.1 2-1.5-2-3.4-2.4 1a9 9 0 0 0-1.9-1.1L16.3 3h-4l-.4 2.9A9 9 0 0 0 10 7L7.6 6 5.6 9.4l2 1.5a9 9 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a9 9 0 0 0 1.9 1.1l.4 2.9h4l.4-2.9a9 9 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5.1-1.1Z" />
        </svg>
      </button>
    </div>
  );
}
