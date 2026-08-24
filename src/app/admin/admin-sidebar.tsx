"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/churches/new", label: "教会を作成" },
  {
    href: "/admin/churches/password-reset",
    label: "パスワードを再設定",
  },
  { href: "/admin/admin-users", label: "管理者" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar" aria-label="管理メニュー">
      <div className="admin-sidebar-brand">
        <span>Levi</span>
        <strong>管理画面</strong>
      </div>
      <nav>
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <Link
              aria-current={current ? "page" : undefined}
              className="admin-nav-link"
              href={item.href}
              key={item.href}
            >
              <span aria-hidden="true" className="admin-nav-marker" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
