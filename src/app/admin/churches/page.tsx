import Link from "next/link";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";
import { listChurches } from "@/infrastructure/database/church-directory";
import { ChurchList } from "./church-list";

export default async function ChurchAdministrationPage() {
  await requireAdminPageAccess();
  const churches = await listChurches();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会管理</p>
        <h1>教会一覧</h1>
        <p>登録されている教会と利用者の状態を確認できます。</p>
        <Link
          className="primary-button admin-header-action"
          href="/admin/churches/new"
        >
          教会を作成
        </Link>
      </header>
      <ChurchList churches={churches} />
    </main>
  );
}
