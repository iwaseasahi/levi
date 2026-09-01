import type { ReactNode } from "react";
import { ChurchNavigation } from "@/app/church/church-navigation";

export function SlideManageShell({ children }: { children: ReactNode }) {
  return (
    <main className="slide-page">
      <ChurchNavigation />
      {children}
    </main>
  );
}
