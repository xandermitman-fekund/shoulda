"use client";

import { useEffect, useRef, useState } from "react";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  imageType?: string;
  imageData?: string;
};

const READY_MARKER = "[[READY]]";

// Hide the marker (and any partial still streaming in) from what the user sees.
function stripMarker(s: string): string {
  return s
    .replace(/\[\[READY\]\]/g, "")
    .replace(/\[\[?[A-Z]{0,5}\]?$/, "")
    .trimEnd();
}

// Resize/compress a picked image client-side so payloads + token cost stay small.
async function fileToImage(file: File): Promise<{ type: string; data: string }> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const el = document.createElement("img");
    el.onload = () => res(el);
    el.onerror = () => rej(new Error("decode failed"));
    el.src = dataUrl;
  });
  const MAX = 1536;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (Math.max(w, h) > MAX) {
    const s = MAX / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.85);
  return { type: "image/jpeg", data: out.split(",")[1] ?? "" };
}

export default function IntakeChat({
  partyName,
  opener,
  messages,
  streaming,
  onAdvance,
  onSend,
}: {
  partyName: string;
  opener: string;
  messages: Msg[];
  streaming: boolean;
  onAdvance: () => void;
  onSend: (text: string, image?: { type: string; data: string }) => void;
}) {
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    type: string;
    data: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  // Show the "next step" nudge once the mediator signals it's wrapping up
  // (the [[READY]] marker), with a fallback for conversations already underway.
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const ready =
    messages.some(
      (m) => m.role === "assistant" && m.content.includes(READY_MARKER),
    ) || assistantCount >= 4;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setProcessing(true);
    try {
      setPendingImage(await fileToImage(file));
    } catch {
      // ignore a bad image
    } finally {
      setProcessing(false);
    }
  }

  function submit() {
    const text = input.trim();
    if ((!text && !pendingImage) || streaming || processing) return;
    const img = pendingImage ?? undefined;
    setInput("");
    setPendingImage(null);
    onSend(text, img);
  }

  return (
    <section className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-3">
        <p className="text-sm font-medium text-stone-900">Meet the mediator</p>
        <p className="text-xs text-stone-500">
          A private chat so the mediator gets to know {partyName}.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Bubble role="assistant" content={opener} />
        {messages.map((m, i) => (
          <Bubble
            key={i}
            role={m.role}
            content={stripMarker(m.content)}
            imageType={m.imageType}
            imageData={m.imageData}
          />
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <Bubble role="assistant" content="…" />
        )}
      </div>

      {/* Recommended next action, revealed when intake is sufficiently complete */}
      {ready && !streaming && (
        <div className="border-t border-emerald-100 bg-emerald-50/60 px-3 py-3">
          <button
            onClick={onAdvance}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Next: share what matters to you →
          </button>
          <p className="mt-1.5 text-center text-xs text-stone-400">
            You can keep chatting with the mediator, or move on whenever you&apos;re ready.
          </p>
        </div>
      )}

      <div className="border-t border-stone-100 p-3">
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${pendingImage.type};base64,${pendingImage.data}`}
              alt="attachment preview"
              className="h-14 w-14 rounded-lg border border-stone-200 object-cover"
            />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100"
            >
              Remove
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={streaming || processing}
            title="Attach an image"
            className="rounded-lg border border-stone-300 px-3 py-2 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
          >
            {processing ? "…" : "📎"}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingImage ? "Add a note (optional)…" : `Reply as ${partyName}…`
            }
            disabled={streaming}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={streaming || processing || (!input.trim() && !pendingImage)}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function Bubble({
  role,
  content,
  imageType,
  imageData,
}: {
  role: "user" | "assistant";
  content: string;
  imageType?: string;
  imageData?: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] space-y-2 rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-800"
        }`}
      >
        {imageData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${imageType ?? "image/jpeg"};base64,${imageData}`}
            alt="shared"
            className="max-h-60 rounded-lg"
          />
        )}
        {content && <div className="whitespace-pre-wrap">{content}</div>}
      </div>
    </div>
  );
}
