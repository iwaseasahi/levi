import { provisionChurchAction } from "../actions";
import { ProvisionChurchForm } from "../provision-church-form";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function NewChurchPage() {
  await requireAdminPageAccess();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会管理</p>
        <h1>教会を作成</h1>
        <p>
          教会と最初の利用者を同時に作成し、本人へパスワード設定用の招待メールを送信します。
        </p>
      </header>
      <ProvisionChurchForm action={provisionChurchAction} />
    </main>
  );
}
