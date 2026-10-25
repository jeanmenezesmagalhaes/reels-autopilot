"use client";

import { useActionState } from "react";
import { addLlmKey, type KeyState } from "../actions";

type Copy = { provider: string; placeholder: string; add: string; adding: string; ok: string; bad: string };
type Option = { id: string; name: string; keyUrl: string; where: string };

// Paste a key, pick the AI; the server tests it before saving.
export function KeyForm({ copy, options }: { copy: Copy; options: Option[] }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(addLlmKey, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="provider">
          {copy.provider}
        </label>
        <select
          id="provider"
          name="provider"
          className="rounded-full border border-rule bg-ground px-4 py-2 text-[15px] focus:border-ink focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="key">
          {copy.placeholder}
        </label>
        <input
          id="key"
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder={copy.placeholder}
          className="min-w-0 flex-1 rounded-full border border-rule bg-ground px-4 py-2 text-[15px] placeholder:text-ink-muted focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-full bg-ink px-5 py-2 text-[15px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? copy.adding : copy.add}
        </button>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {options.map((o) => (
          <a key={o.id} href={o.keyUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-ink hover:underline">
            {o.where}
          </a>
        ))}
      </p>
      {state?.result && (
        <p role="status" className={`text-[15px] ${state.result === "ok" ? "text-ok" : "text-bad"}`}>
          {state.result === "ok" ? copy.ok : copy.bad}
        </p>
      )}
    </form>
  );
}
