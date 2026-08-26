import Link from "next/link";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function AdministrationPage() {
  await requireAdminPageAccess();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">Levi administration</p>
        <h1>管理画面</h1>
        <p>実行する管理操作を選択してください。</p>
      </header>

      <nav className="admin-dashboard" aria-label="管理機能">
        <Link href="/admin/churches/new">
          <span className="admin-dashboard-icon" aria-hidden="true">
            ＋
          </span>
          <span>
            <strong>教会を作成</strong>
            <small>教会と最初の利用者を登録します</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/admin/churches/password-reset">
          <span className="admin-dashboard-icon" aria-hidden="true">
            ↻
          </span>
          <span>
            <strong>パスワードを再設定</strong>
            <small>教会利用者へ新しい一時パスワードを発行します</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/admin/admin-users">
          <span className="admin-dashboard-icon" aria-hidden="true">
            ◎
          </span>
          <span>
            <strong>管理者の一覧</strong>
            <small>登録済みの管理者IDと状態を確認します</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </main>
  );
}
