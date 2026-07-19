"use client";

// Shared, ephemeral store so reviewers can deflate time straight off a commit or
// a journal row and have it subtract from the credited-hours total in the review
// form. Keyed per item (c:<sha> / j:<id>), values are minutes to remove. Lives
// only in the browser for the current review; reset when the form mounts.

type Sub = () => void;

const deductions = new Map<string, number>();
const subs = new Set<Sub>();

function notify() {
  for (const s of subs) s();
}

export function setDeduction(key: string, minutes: number): void {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  if (m > 0) deductions.set(key, m);
  else deductions.delete(key);
  notify();
}

export function getDeduction(key: string): number {
  return deductions.get(key) ?? 0;
}

export function totalDeductedMinutes(): number {
  let t = 0;
  for (const v of deductions.values()) t += v;
  return t;
}

export function resetDeductions(): void {
  if (deductions.size === 0) return;
  deductions.clear();
  notify();
}

export function subscribeDeductions(s: Sub): () => void {
  subs.add(s);
  return () => {
    subs.delete(s);
  };
}
