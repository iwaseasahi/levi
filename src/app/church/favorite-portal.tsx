"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribeToClient = () => () => {};

export function FavoritePortal({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  if (!isClient) return null;
  const target = document.getElementById("ginmaku-add-bookmark-slot");
  return target ? createPortal(children, target) : null;
}
