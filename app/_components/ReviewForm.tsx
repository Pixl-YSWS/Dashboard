"use client";

import { useState } from "react";
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

export function ReviewForm({ projectId }: { projectId: number }) {
  return (
    <form action={reviewProject} className="mt-4 flex flex-wrap gap-2 items-start">
      <input type="hidden" name="projectId" value={projectId} />
      <textarea
        name="note"
        placeholder="Reviewer note (required to send back, optional on approve)"
        className="pixl-input flex-1 min-w-64 text-sm"
        rows={2}
      />
      <VerdictButtons />
    </form>
  );
}
