"use client";

import { useState } from "react";
import { sendNotification } from "@/app/actions";

export function NotifyForm() {
  const [everyone, setEveryone] = useState(true);
  const [player, setPlayer] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

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
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Player name</span>
            <input
              name="playerName"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="Exact display name"
              required={!everyone}
              className="pixl-input w-full text-sm"
            />
          </label>
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
