import type { ReactNode } from "react";
import { SlideNavigation } from "./slide-navigation";

export function SlideManageShell({ children }: { children: ReactNode }) {
  return (
    <main className="slide-page">
      <SlideNavigation />
      {children}
    </main>
  );
}
