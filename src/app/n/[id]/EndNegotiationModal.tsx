"use client";

import { useState } from "react";
import {
  endNegotiation,
  RESOLUTION_TYPES,
  HELPED_SCALE,
  type Closure,
} from "./status-actions";

/** Guide-only "End negotiation" dialog: outcome + exit survey. */
export default function EndNegotiationModal({
  negotiationId,
  initial,
  onClose,
  onEnded,
}: {
  negotiationId: string;
  initial: Closure | null;
  onClose: () => void;
  onEnded: (status: string) => void;
}) {
  const [resolutionType, setResolutionType] = useState(
    initial?.resolutionType ?? "",
  );
  const [fbHelped, setFbHelped] = useState(initial?.fbHelped ?? "");
  const [fbFavorite, setFbFavorite] = useState(initial?.fbFavorite ?? "");
  const [fbChange, setFbChange] = useState(initial?.fbChange ?? "");
  const [fbOther, setFbOther] = useState(initial?.fbOther ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!resolutionType || saving) return;
    setSaving(true);
    try {
      const r = await endNegotiation(negotiationId, {
        resolutionType,
        fbHelped,
        fbFavorite,
        fbChange,
        fbOther,
      });
      if (r.ok) onEnded(r.status);
    } finally {
      setSaving(false);
    }
  }

  const taClass =
    "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900">End negotiation</h2>
        <p className="mt-1 text-sm text-stone-500">
          Mark the outcome and share a little feedback. Your answers go to Xander to
          improve the app.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              How did it end? <span className="text-red-500">*</span>
            </label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className={taClass}
            >
              <option value="" disabled>
                Choose a resolution…
              </option>
              {RESOLUTION_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              &ldquo;This app helped me run a better negotiation.&rdquo;
            </label>
            <select
              value={fbHelped}
              onChange={(e) => setFbHelped(e.target.value)}
              className={taClass}
            >
              <option value="">No answer</option>
              {HELPED_SCALE.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              What is your favorite thing about using this app?
            </label>
            <textarea
              rows={3}
              value={fbFavorite}
              onChange={(e) => setFbFavorite(e.target.value)}
              className={taClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              If you could change one thing about this app, what would it be?
            </label>
            <textarea
              rows={3}
              value={fbChange}
              onChange={(e) => setFbChange(e.target.value)}
              className={taClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              Anything else you would like to share with Xander?
            </label>
            <textarea
              rows={3}
              value={fbOther}
              onChange={(e) => setFbOther(e.target.value)}
              className={taClass}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-400"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!resolutionType || saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? "Ending…" : "End negotiation"}
          </button>
        </div>
      </div>
    </div>
  );
}
