"use client";

import { useFormStatus } from "react-dom";

type Props = { children: React.ReactNode; pending: string; variant?: "primary" | "quiet" | "ink" | "row" | "card" };

const styles = {
  primary: "bg-ink text-ground hover:opacity-85 px-5 py-2 text-[15px] font-medium rounded-full",
  quiet: "bg-ground-raised text-ink hover:bg-rule px-5 py-2 text-[15px] font-medium rounded-full",
  ink: "bg-ink text-ground hover:opacity-85 px-4 py-2 text-[15px] font-medium rounded-full",
  row: "text-sm font-medium text-ink-muted hover:text-ink",
  // Small pill for actions inside a grey card: white on the card, readable as a button.
  card: "bg-ground text-ink hover:bg-rule px-3 py-1 text-sm font-medium rounded-full",
};

export function SubmitButton({ children, pending, variant = "quiet" }: Props) {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} aria-busy={status.pending} className={`${styles[variant]} cursor-pointer transition-[color,background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-wait disabled:opacity-50`}>
      {status.pending ? pending : children}
    </button>
  );
}
