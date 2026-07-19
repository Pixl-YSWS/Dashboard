"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PendingButton({
  children,
  pendingText = "Working…",
  ...props
}: ComponentProps<typeof Button> & {
  children: ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
