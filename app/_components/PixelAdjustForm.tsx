"use client";

import { useEffect, useRef, useState } from "react";
import { adjustPixels, searchPlayers, type PlayerHit } from "@/app/actions";

// Owner-only manual pixel correction: pick a player, deduct or grant whole
// pixels with a mandatory reason. Everything lands in the ledger.
export function PixelAdjustForm() {
  const [player, setPlayer] = useState("");
  const [selected, setSelected] = useState<PlayerHit | null>(null);
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"deduct" | "grant">("deduct");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && player === selected.name) {
      setOpen(false);
      return;
    }
    const q = player.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const t = setTimeout(async () => {
      try {
        setHits(await searchPlayers(q));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [player, selected]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <details className="pixl-card p-4 mb-6">
      <summary className="cursor-pointer text-sm font-semibold select-none">
        Adjust a player&apos;s pixels (owners only)
      </summary>
      <form action={adjustPixels} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] items-start">
        <div ref={boxRef} className="relative">
          {selected && <input type="hidden" name="userId" value={selected.id} />}
          <input
            autoComplete="off"
            value={player}
            onChange={(e) => {
              setPlayer(e.target.value);
              setSelected(null);
            }}
            onFocus={() => hits.length > 0 && setOpen(true)}
            placeholder="Search player…"
            required
            className="pixl-input w-full text-sm"
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg overflow-hidden">
              {searching && hits.length === 0 && (
                <div className="px-3 py-2 text-sm text-ink/50">Searching…</div>
              )}
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSelected(h);
                    setPlayer(h.name);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {h.name}
                </button>
              ))}
              {!searching && hits.length === 0 && (
                <div className="px-3 py-2 text-sm text-ink/50">No players found.</div>
              )}
            </div>
          )}
        </div>
        <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
          <input type="hidden" name="mode" value={mode} />
          <button
            type="button"
            onClick={() => setMode("deduct")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              mode === "deduct" ? "bg-brand text-white" : "text-ink/60 hover:text-ink"
            }`}
          >
            Deduct
          </button>
          <button
            type="button"
            onClick={() => setMode("grant")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              mode === "grant" ? "bg-hc-green text-white" : "text-ink/60 hover:text-ink"
            }`}
          >
            Grant
          </button>
        </div>
        <input
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          placeholder="Pixels"
          className="pixl-input w-28 text-sm"
        />
        <textarea
          name="reason"
          required
          rows={2}
          placeholder="Reason (required — shown to the player and kept in the log)…"
          className="pixl-input text-sm resize-y sm:col-span-2"
        />
        <button
          className={`pixl-btn text-white border-transparent text-sm ${
            mode === "deduct" ? "bg-brand" : "bg-hc-green"
          }`}
        >
          {mode === "deduct" ? "Deduct pixels" : "Grant pixels"}
        </button>
      </form>
    </details>
  );
}
