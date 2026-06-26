// src/components/agent/ContactForm.tsx
//
// Collects the lead's contact info before a call can start. At least one of
// email / phone is required, and if an email is entered it must be valid.
// Single-purpose: renders the fields + inline validation, and reports validity
// and values up to the parent. Disabled once a call is connected/connecting.

import { useId } from "react";

export type ContactInfo = { email: string; phone: string };

type Props = {
  value: ContactInfo;
  onChange: (next: ContactInfo) => void;
  disabled?: boolean;
};

// Pragmatic email check: non-empty local part, @, domain with a dot. Good
// enough to catch typos without rejecting valid-but-unusual addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// The form is "ready to start" when at least one contact method is provided
// and any email present is valid.
export function isContactReady({ email, phone }: ContactInfo): boolean {
  const e = email.trim();
  const p = phone.trim();
  if (e && !isEmailValid(e)) return false;
  return Boolean(e || p);
}

export function ContactForm({ value, onChange, disabled }: Props) {
  const emailId = useId();
  const phoneId = useId();

  const emailTrimmed = value.email.trim();
  const emailError = emailTrimmed.length > 0 && !isEmailValid(emailTrimmed);
  const nothingEntered = !emailTrimmed && !value.phone.trim();

  const fieldClass = (invalid: boolean) =>
    `rounded-xl border bg-white/5 px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition-colors disabled:opacity-50 ${
      invalid
        ? "border-red-500/70 focus:border-red-500"
        : "border-white/10 focus:border-[#ea175c]"
    }`;

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="text-sm text-zinc-400">
        Enter your email or phone number to start.{" "}
        <span className="text-zinc-500">(at least one required)</span>
      </p>

      <label htmlFor={emailId} className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Email</span>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={value.email}
          disabled={disabled}
          aria-invalid={emailError}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className={fieldClass(emailError)}
        />
        {emailError && (
          <span id={`${emailId}-error`} className="text-xs text-red-500">
            Enter a valid email address.
          </span>
        )}
      </label>

      <label htmlFor={phoneId} className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Phone</span>
        <input
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={value.phone}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className={fieldClass(false)}
        />
      </label>

      {nothingEntered && (
        <p className="text-xs text-zinc-400">
          Add an email or phone number to enable the call.
        </p>
      )}
    </div>
  );
}
