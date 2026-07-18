"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function PendingButton({
  className,
  children,
  pendingText = "Working…",
}: {
  className?: string;
  children: ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`${className ?? ""} disabled:opacity-60 disabled:pointer-events-none`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
