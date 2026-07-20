"use client";

import { useState } from "react";
import {
  createParty,
  renameParty,
  setPointBudget,
  deleteParty,
} from "./party-actions";

export type ManagedParty = {
  id: string;
  displayName: string;
  role: string;
  pointBudget: number;
  inviteCode: string;
  claimed: boolean;
  isViewer: boolean;
};

/** Owner-only panel: create stakeholder seats, set point budgets, copy per-seat invite links. */
export default function PartyManager({
  negotiationId,
  parties,
  onCreated,
  onRenamed,
  onBudget,
  onDeleted,
}: {
  negotiationId: string;
  parties: ManagedParty[];
  onCreated: (p: ManagedParty) => void;
  onRenamed: (id: string, name: string) => void;
  onBudget: (id: string, budget: number) => void;
  onDeleted: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const p = await createParty(negotiationId, name, newBudget);
    if (p) {
      onCreated({ ...p, claimed: p.userId !== null, isViewer: false });
      setNewName("");
      setNewBudget(10);
    }
  }

  function copyLink(inviteCode: string, id: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/join/${inviteCode}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-medium text-stone-900">Parties</h3>
      <p className="mt-1 text-xs text-stone-400">
        Create a seat for each party. Give each a point budget, and optionally invite
        a real person to represent themselves — or work on their behalf.
      </p>

      <ul className="mt-3 space-y-2">
        {parties.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2"
          >
            <input
              defaultValue={p.displayName}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.displayName) {
                  renameParty(p.id, v);
                  onRenamed(p.id, v);
                }
              }}
              className="min-w-[8rem] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-stone-800 hover:border-stone-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-stone-500">
              budget
              <input
                type="number"
                min={0}
                defaultValue={p.pointBudget}
                onBlur={(e) => {
                  const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                  if (v !== p.pointBudget) {
                    setPointBudget(p.id, v);
                    onBudget(p.id, v);
                  }
                }}
                className="w-14 rounded border border-stone-300 px-1.5 py-0.5 text-sm text-stone-800 outline-none focus:border-emerald-500"
              />
            </label>
            {p.claimed ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                claimed
              </span>
            ) : (
              <button
                onClick={() => copyLink(p.inviteCode, p.id)}
                className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 hover:border-stone-400"
              >
                {copiedId === p.id ? "Link copied ✓" : "Copy invite link"}
              </button>
            )}
            {!p.isViewer && (
              <button
                onClick={() => {
                  deleteParty(p.id);
                  onDeleted(p.id);
                }}
                title="Remove party"
                className="rounded-md px-1.5 py-0.5 text-xs text-stone-400 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New party name…"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
        <label className="flex items-center gap-1 text-xs text-stone-500">
          budget
          <input
            type="number"
            min={0}
            value={newBudget}
            onChange={(e) => setNewBudget(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="w-14 rounded border border-stone-300 px-1.5 py-1 text-sm outline-none focus:border-emerald-500"
          />
        </label>
        <button
          onClick={add}
          disabled={!newName.trim()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Add party
        </button>
      </div>
    </section>
  );
}
