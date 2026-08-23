"use client";

import { useState } from "react";

/** Keeps an injected dependency fixed from the first render until unmount. */
export function useComponentLifetimeValue<T>(value: T): T {
  const [lifetimeValue] = useState(() => value);
  return lifetimeValue;
}
