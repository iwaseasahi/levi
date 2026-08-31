"use client";

import { SlideDocument } from "./slide-document";
import { SlideManageShell } from "./slide-manage-shell";
import { SlideSidebar } from "./slide-sidebar";

export function SlideDetailWorkspace({ id }: { id: string }) {
  return (
    <div className="slide-index-workspace">
      <SlideSidebar onSelectedFolderChange={() => undefined} refreshKey={0} />
      <SlideManageShell>
        <SlideDocument id={id} />
      </SlideManageShell>
    </div>
  );
}
