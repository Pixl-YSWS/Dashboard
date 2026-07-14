"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewProject } from "@/app/actions";

function VerdictButtons() {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState("");
  return (
    <>
      <button
        name="verdict"
        value="approved"
        disabled={pending}
        onClick={() => setClicked("approved")}
        className="pixl-btn bg-emerald-700 text-white disabled:opacity-60"
      >
        {pending && clicked === "approved" ? "Approving…" : "Approve"}
      </button>
      <button
        name="verdict"
        value="needs_changes"
        disabled={pending}
        onClick={() => setClicked("needs_changes")}
        className="pixl-btn bg-red-700 text-white disabled:opacity-60"
      >
        {pending && clicked === "needs_changes" ? "Sending back…" : "Send back"}
      </button>
    </>
  );
}

export function ReviewForm({
  projectId,
  repoUrl,
  demoUrl,
  claimedHours,
}: {
  projectId: number;
  repoUrl: string | null;
  demoUrl: string | null;
  claimedHours: number;
}) {
  const repoOpened = useRef<HTMLInputElement>(null);
  const demoOpened = useRef<HTMLInputElement>(null);
  const repoSeconds = useRef<HTMLInputElement>(null);
  const demoSeconds = useRef<HTMLInputElement>(null);
  const totalSeconds = useRef<HTMLInputElement>(null);
  const away = useRef<{ kind: "repo" | "demo"; at: number } | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    openedAt.current = Date.now();
    const settle = () => {
      const a = away.current;
      if (!a || document.visibilityState !== "visible") return;
      away.current = null;
      const el = a.kind === "repo" ? repoSeconds.current : demoSeconds.current;
      if (el)
        el.value = String(
          Math.round(Number(el.value || 0) + (Date.now() - a.at) / 1000),
        );
    };
    window.addEventListener("focus", settle);
    document.addEventListener("visibilitychange", settle);
    return () => {
      window.removeEventListener("focus", settle);
      document.removeEventListener("visibilitychange", settle);
    };
  }, []);

  const markOpen = (kind: "repo" | "demo") => {
    const el = kind === "repo" ? repoOpened.current : demoOpened.current;
    if (el) el.value = "1";
    away.current = { kind, at: Date.now() };
  };

  return (
    <form
      action={reviewProject}
      onSubmit={() => {
        if (totalSeconds.current)
          totalSeconds.current.value = String(
            Math.round((Date.now() - openedAt.current) / 1000),
          );
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="repoOpened" defaultValue="0" ref={repoOpened} />
      <input type="hidden" name="demoOpened" defaultValue="0" ref={demoOpened} />
      <input type="hidden" name="repoSeconds" defaultValue="0" ref={repoSeconds} />
      <input type="hidden" name="demoSeconds" defaultValue="0" ref={demoSeconds} />
      <input type="hidden" name="totalSeconds" defaultValue="0" ref={totalSeconds} />
      <div className="flex flex-wrap gap-2 items-center text-sm font-bold">
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markOpen("repo")}
            className="pixl-btn bg-ink dark:bg-gray-700 text-white"
          >
            Repo
          </a>
        )}
        {demoUrl && (
          <a
            href={demoUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markOpen("demo")}
            className="pixl-btn bg-ink dark:bg-gray-700 text-white"
          >
            Demo
          </a>
        )}
        <label className="flex items-center gap-2 ml-auto font-normal text-ink/70">
          Hours to credit
          <input
            name="approvedHours"
            type="number"
            step="0.1"
            min="0"
            placeholder={String(claimedHours)}
            className="pixl-input w-24 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 items-start">
        <textarea
          name="note"
          required
          placeholder="Feedback for the player (required)"
          className="pixl-input flex-1 min-w-64 text-sm"
          rows={2}
        />
        <VerdictButtons />
      </div>
    </form>
  );
}
