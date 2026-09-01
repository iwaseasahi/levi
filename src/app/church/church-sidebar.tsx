"use client";

import { useRouter } from "next/navigation";
import { SavedContentPanel } from "./saved-content-panel";
import { scriptureSearchLink } from "./scripture-search-link";

const ignoreFolderSelection = () => undefined;

export function ChurchSidebar({
  onSelectedFolderChange = ignoreFolderSelection,
  refreshKey = 0,
  fetcher = fetch,
}: {
  onSelectedFolderChange?(folderId: string | null): void;
  refreshKey?: number;
  fetcher?: typeof fetch;
}) {
  const router = useRouter();
  return (
    <aside
      id="bookmark_container"
      className="ginmaku-bookmark-container"
      aria-label="サイドバー"
    >
      <SavedContentPanel
        currentSearch={null}
        currentSearchTitle=""
        fetcher={fetcher}
        onSelectSearch={async (search) => {
          router.push(scriptureSearchLink(search));
        }}
        onSelectSlide={async (slideId) => router.push(`/slides/${slideId}`)}
        onSelectedFolderChange={onSelectedFolderChange}
        refreshKey={refreshKey}
      />
    </aside>
  );
}
