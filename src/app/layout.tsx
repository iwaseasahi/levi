import type { Metadata } from "next";

import { SEARCH_ENGINE_ROBOTS_METADATA } from "@/config/search-engine-indexing";

import "./styles.css";

export const metadata: Metadata = {
  title: "Levi",
  description: "A worship presentation system",
  robots: SEARCH_ENGINE_ROBOTS_METADATA,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
