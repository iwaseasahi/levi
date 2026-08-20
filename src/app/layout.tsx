import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Levi",
  description: "A worship presentation system",
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
