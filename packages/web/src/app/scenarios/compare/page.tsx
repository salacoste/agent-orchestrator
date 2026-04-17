import Link from "next/link";
import { ScenarioComparisonView } from "@/components/ScenarioComparisonView";

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ScenarioComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const idsParam = params.ids ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Scenario Comparison</h1>

      {ids.length < 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            At least 2 scenario IDs are required for comparison.
          </p>
          <Link href="/scenarios" className="text-sm text-[var(--color-accent)] hover:underline">
            &larr; Back to Scenarios
          </Link>
        </div>
      ) : (
        <ScenarioComparisonView ids={ids} />
      )}
    </div>
  );
}
