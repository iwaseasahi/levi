import { ScriptureSearch } from "@/app/church/scripture-search";
import { ScriptureSettingsMenu } from "@/app/church/scripture-settings-menu";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";

export default async function ScripturePage() {
  await requireChurchPageAccess();
  return (
    <main className="ginmaku-search-page">
      <ScriptureSearch />
      <ScriptureSettingsMenu />
    </main>
  );
}
