"use client";

import { useRouter } from "next/navigation";
import { SavedContentPanel } from "@/app/church/saved-content-panel";
import { scriptureSearchLink } from "@/app/church/scripture-search-link";

export function SlideSidebar() {
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
        fetcher={fetch}
        onSelectSearch={async (search) => {
          router.push(scriptureSearchLink(search));
        }}
      />
    </aside>
  );
}
