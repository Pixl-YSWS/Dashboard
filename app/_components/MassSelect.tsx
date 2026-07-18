"use client";

export function SelectAllBox() {
  return (
    <input
      type="checkbox"
      aria-label="Select all on this page"
      className="w-4 h-4 align-middle"
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        for (const el of form.querySelectorAll<HTMLInputElement>('input[name="userIds"]'))
          el.checked = e.currentTarget.checked;
      }}
    />
  );
}
