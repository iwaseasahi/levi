"use client";

import Link from "next/link";
import { useState } from "react";
import { SlideList } from "./slide-list";
import { SlideNavigation } from "./slide-navigation";
import { SlideSidebar } from "./slide-sidebar";

export function SlideIndex() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="slide-index-workspace">
      <SlideSidebar
        onSelectedFolderChange={setSelectedFolderId}
        refreshKey={refreshKey}
      />
      <main className="slide-page">
        <SlideNavigation />
        <header className="slide-list-header">
          <h1>スライドの一覧</h1>
          <Link className="slide-create-link" href="/slides/new">
            スライドを作成
          </Link>
        </header>
        <SlideList
          selectedFolderId={selectedFolderId}
          onFavoriteSaved={() => setRefreshKey((value) => value + 1)}
        />
      </main>
    </div>
  );
}
