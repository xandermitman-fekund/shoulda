"use client";

import { useEffect, useState } from "react";
import { getChangeLog, type ChangeLogEntry } from "./audit-actions";

/** Read-only change log for one [workspace × party] — who changed what, and whether by proxy. */
export default function ChangeLog({
  negotiationId,
  partyId,
  partyName,
}: {
  negotiationId: string;
  partyId: string;
  partyName: string;
}) {
  const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setEntries(await getChangeLog(negotiationId, partyId));
    } finally {
      setLoading(false);
    }
  }

  // Reload whenever the selected party changes.
  useEffect(() => {
    setEntries(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-900">
          Change log · {partyName}
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-medium text-stone-500 hover:text-stone-800 disabled:opacity-50"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        Every change made for this party, and who made it.
      </p>

      {entries && entries.length === 0 ? (
        <p className="mt-3 text-sm text-stone-400">No changes yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {(entries ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
              <div>
                <span className="text-stone-700">{e.detail ?? e.action}</span>
                <span className="ml-2 text-xs text-stone-400">
                  {e.actorLabel}
                  {e.isProxy && " (on their behalf)"} ·{" "}
                  {e.createdAt.slice(0, 16).replace("T", " ")} UTC
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
