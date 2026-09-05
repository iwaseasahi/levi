import { ScriptureWorkspace } from "@/app/church/scripture-workspace";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { scriptureSelectionFromQuery } from "@/app/church/scripture-search-link";

export default async function ScripturePage({
  searchParams,
}: PageProps<"/scripture">) {
  await requireChurchPageAccess();
  const initialSelection = scriptureSelectionFromQuery(await searchParams);
  return (
    <main className="ginmaku-search-page">
      <ScriptureWorkspace
        key={JSON.stringify(initialSelection)}
        initialSelection={initialSelection}
      />
    </main>
  );
}
