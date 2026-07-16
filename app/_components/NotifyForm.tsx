"use client";

import { useEffect, useRef, useState } from "react";
import { sendNotification, searchPlayers, type PlayerHit } from "@/app/actions";

export function NotifyForm() {
  const [everyone, setEveryone] = useState(true);
  const [player, setPlayer] = useState("");
  const [selected, setSelected] = useState<PlayerHit | null>(null);
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && player === selected.name) return;
    const q = player.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchPlayers(q);
        setHits(res);
        setOpen(true);
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

  const pick = (hit: PlayerHit) => {
    setSelected(hit);
    setPlayer(hit.name);
    setOpen(false);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <form action={sendNotification} className="pixl-card p-5 space-y-4">
        <input type="hidden" name="backTo" value="/notify" />

        <div>
          <div className="text-sm font-medium mb-2">Audience</div>
          <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setEveryone(true)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                everyone ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              Everyone
            </button>
            <button
              type="button"
              onClick={() => setEveryone(false)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                !everyone ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              One player
            </button>
          </div>
        </div>

        {!everyone && (
          <div className="block" ref={boxRef}>
            <span className="block text-sm font-medium mb-1.5">Player</span>
            <div className="relative">
              {selected && <input type="hidden" name="userId" value={selected.id} />}
              <input
                name="playerName"
                autoComplete="off"
                value={player}
                onChange={(e) => {
                  setPlayer(e.target.value);
                  setSelected(null);
                }}
                onFocus={() => hits.length > 0 && setOpen(true)}
                placeholder="Search by display name…"
                required={!everyone}
                className="pixl-input w-full text-sm"
              />
              {open && (hits.length > 0 || searching) && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg overflow-hidden">
                  {searching && hits.length === 0 && (
                    <div className="px-3 py-2 text-sm text-ink/50">Searching…</div>
                  )}
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => pick(h)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <span className="grid place-items-center w-6 h-6 rounded-full bg-brand/15 text-brand text-[0.65rem] font-semibold shrink-0">
                        {h.name.replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium truncate">{h.name}</span>
                      {!h.hasSlack && (
                        <span className="ml-auto text-[0.7rem] text-amber-600 dark:text-amber-400 shrink-0">
                          no slack — no DM
                        </span>
                      )}
                    </button>
                  ))}
                  {!searching && hits.length === 0 && (
                    <div className="px-3 py-2 text-sm text-ink/50">No players found.</div>
                  )}
                </div>
              )}
            </div>
            {selected ? (
              <span className="block text-xs text-ink/50 mt-1">
                Selected <span className="font-medium text-ink/70">{selected.name}</span>
                {!selected.hasSlack && " · no Slack linked, so they won't get a DM (inbox only)"}
              </span>
            ) : (
              <span className="block text-xs text-ink/45 mt-1">
                Pick a player from the list — no need to type the exact name.
              </span>
            )}
          </div>
        )}

        <label className="block">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-medium">Title</span>
            <span className="text-xs text-ink/40 tabular-nums">{title.length}/100</span>
          </div>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
            placeholder="e.g. New season is live!"
            className="pixl-input w-full text-sm"
          />
        </label>

        <label className="block">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-medium">Message</span>
            <span className="text-xs text-ink/40 tabular-nums">{body.length}/500</span>
          </div>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={5}
            required
            placeholder="Write your message…"
            className="pixl-input w-full text-sm resize-y"
          />
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button className="pixl-btn bg-brand text-white border-transparent text-sm">
            {everyone ? "Send to everyone" : "Send"}
          </button>
          <span className="text-xs text-ink/45">
            {everyone
              ? "Goes to every player's in-game inbox."
              : "Goes to one player's in-game inbox."}
          </span>
        </div>
      </form>

      <div className="lg:sticky lg:top-24">
        <div className="text-xs font-medium text-ink/50 uppercase tracking-wide mb-2">Preview</div>
        <div className="pixl-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="grid place-items-center w-6 h-6 rounded-md bg-brand text-white text-[0.6rem] font-bold">
              P
            </span>
            <span className="text-xs text-ink/50">Pixl · inbox</span>
          </div>
          <div className="font-semibold text-sm break-words">{title || "Title"}</div>
          <div className="text-sm text-ink/70 mt-1 whitespace-pre-wrap break-words">
            {body || "Your message will appear here."}
          </div>
          <div className="text-[0.7rem] text-ink/40 mt-3">
            {everyone ? "To: everyone" : `To: ${player || "…"}`}
          </div>
        </div>
      </div>
    </div>
  );
}
