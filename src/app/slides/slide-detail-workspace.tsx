"use client";

import { useState } from "react";
import { ChurchSidebar } from "@/app/church/church-sidebar";
import { SlideDocument } from "./slide-document";
import { SlideManageShell } from "./slide-manage-shell";

export function SlideDetailWorkspace({ id }: { id: string }) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="church-sidebar-workspace">
      <ChurchSidebar
        onSelectedFolderChange={setSelectedFolderId}
        refreshKey={refreshKey}
      />
      <SlideManageShell>
        <SlideDocument
          id={id}
          selectedFolderId={selectedFolderId}
          onFavoriteSaved={() => setRefreshKey((value) => value + 1)}
        />
      </SlideManageShell>
    </div>
  );
}
