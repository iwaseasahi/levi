import { ScriptureSearch } from "@/app/church/scripture-search";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";

export default async function ScripturePage() {
  await requireChurchPageAccess();
  return (
    <main className="ginmaku-search-page">
      <ScriptureSearch />
    </main>
  );
}
