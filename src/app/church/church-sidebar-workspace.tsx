import type { ReactNode } from "react";
import { ChurchSidebar } from "./church-sidebar";

export function ChurchSidebarWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="church-sidebar-workspace">
      <ChurchSidebar />
      {children}
    </div>
  );
}
