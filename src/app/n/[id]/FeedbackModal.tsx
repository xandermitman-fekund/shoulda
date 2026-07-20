"use client";

import { useState } from "react";
import {
  RESOLUTION_TYPES,
  HELPED_SCALE,
  type FeedbackInput,
} from "./status-actions";

/** Shared survey dialog — used by the Guide to end a negotiation and by any party to give feedback. */
export default function FeedbackModal({
  title,
  intro,
  submitLabel,
  askResolution,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  intro: string;
  submitLabel: string;
  askResolution: boolean; // only the Guide declares the outcome
  initial: FeedbackInput | null;
  onSubmit: (data: FeedbackInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [resolutionType, setResolutionType] = useState(initial?.resolutionType ?? "");
  const [helped, setHelped] = useState(initial?.helped ?? "");
  const [favorite, setFavorite] = useState(initial?.favorite ?? "");
  const [change, setChange] = useState(initial?.change ?? "");
  const [other, setOther] = useState(initial?.other ?? "");
  const [saving, setSaving] = useState(false);

  const missingResolution = askResolution && !resolutionType;

  async function submit() {
    if (missingResolution || saving) return;
    setSaving(true);
    try {
      const ok = await onSubmit({ resolutionType, helped, favorite, change, other });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  }

  const field =
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
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{intro}</p>

        <div className="mt-5 space-y-5">
          {askResolution && (
            <div>
              <label className="block text-sm font-medium text-stone-700">
                How did it end? <span className="text-red-500">*</span>
              </label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value)}
                className={field}
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
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700">
              &ldquo;This app helped us reach a better outcome.&rdquo;
            </label>
            <select
              value={helped}
              onChange={(e) => setHelped(e.target.value)}
              className={field}
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
              value={favorite}
              onChange={(e) => setFavorite(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              If you could change one thing about this app, what would it be?
            </label>
            <textarea
              rows={3}
              value={change}
              onChange={(e) => setChange(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              Anything else you would like to share with Xander?
            </label>
            <textarea
              rows={3}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className={field}
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
            disabled={missingResolution || saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
