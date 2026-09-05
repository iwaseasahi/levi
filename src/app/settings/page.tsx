import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { DefaultSettingsForm } from "./default-settings-form";

export default async function DefaultSettingsPage() {
  await requireChurchPageAccess();

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="default-settings-title">
        <p className="eyebrow">Levi</p>
        <h1 id="default-settings-title">デフォルト設定</h1>
        <DefaultSettingsForm />
      </section>
    </main>
  );
}
