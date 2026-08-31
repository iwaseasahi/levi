import type { ReactNode } from "react";
import { SlideNavigation } from "@/app/slides/slide-navigation";

export default function SlideLayout({ children }: { children: ReactNode }) {
  return (
    <main className="slide-page">
      <SlideNavigation />
      {children}
    </main>
  );
}
