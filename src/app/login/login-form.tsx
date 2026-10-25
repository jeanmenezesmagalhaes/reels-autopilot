"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

type Copy = { password: string; submit: string; submitting: string; wrong: string; locked: string };

export function LoginForm({ copy }: { copy: Copy }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  const error = state?.error ? copy[state.error] : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="password" className="sr-only">
        {copy.password}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        placeholder={copy.password}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "login-error" : undefined}
        className="w-full rounded-full border border-rule bg-ground px-5 py-3 text-[17px] placeholder:text-ink-muted focus:border-ink focus:outline-none aria-invalid:border-bad"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-full bg-ink px-5 py-3 text-[17px] font-medium text-ground transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
      <p id="login-error" role="alert" className="min-h-6 text-center text-[15px] text-bad">
        {error}
      </p>
    </form>
  );
}
