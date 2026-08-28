"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogoutAction } from "./auth-actions";

const items = [
  { href: "/admin", label: "トップ" },
  { href: "/admin/churches", label: "教会一覧" },
  { href: "/admin/admin-users", label: "管理者一覧" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const currentHref = items.reduce<string | undefined>((match, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches || (match && match.length >= item.href.length)) return match;
    return item.href;
  }, undefined);

  return (
    <aside className="admin-sidebar" aria-label="管理メニュー">
      <div className="admin-sidebar-brand">
        <span>Levi</span>
        <strong>管理画面</strong>
      </div>
      <nav>
        {items.map((item) => {
          const current = currentHref === item.href;
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
      <form action={adminLogoutAction} className="admin-sidebar-logout-form">
        <button className="admin-sidebar-logout" type="submit">
          ログアウト
        </button>
      </form>
    </aside>
  );
}
