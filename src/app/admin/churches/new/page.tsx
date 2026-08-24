import { provisionChurchAction } from "../actions";
import { ProvisionChurchForm } from "../provision-church-form";

export default function NewChurchPage() {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会管理</p>
        <h1>教会を作成</h1>
        <p>
          教会と最初の利用者を同時に作成します。一時パスワードは作成直後に
          一度だけ表示されます。
        </p>
      </header>
      <ProvisionChurchForm action={provisionChurchAction} />
    </main>
  );
}
