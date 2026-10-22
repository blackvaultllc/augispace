"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Account recovery: request a reset link, then set the new password.
 *
 * Supabase sends the recovery link to /auth/callback?next=/reset-password,
 * which exchanges the code for a session and lands here. Because that
 * session is a real (recovery) session, updateUser can set the new password.
 * Every user type can use this flow — the role check happens where it
 * matters (workspace/admin APIs), not here.
 */
export function ResetPasswordForm({ initialStage = 'request' }: { initialStage?: 'request' | 'set' } = {}) {
  const router = useRouter();
  // Stage is derived from how the user arrived: the recovery link's callback
  // exchange re-renders this page with a session, flipping the stage server-side.
  const [stage] = useState<"request" | "set">(initialStage);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );
    setBusy(false);
    if (resetError) {
      setError(
        resetError.message.includes("rate")
          ? "Too many requests. Wait a moment, then try again."
          : "We could not send a reset link. Check the address and try again.",
      );
      return;
    }
    setNotice(
      "If that address has an account, a recovery link is on its way. Check your inbox.",
    );
    setEmail("");
  }

  async function setNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        "The password could not be updated. Request a fresh recovery link and try again.",
      );
      return;
    }
    // Password changed; route by where the member goes next.
    router.push("/");
    router.refresh();
  }

  return (
    <main className="member-auth-page">
      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />
      <section className="auth-panel" aria-labelledby="reset-title">
        <Link className="auth-back-link" href="/sign-in">
          <ArrowLeft aria-hidden="true" /> Back to sign in
        </Link>
        <div className="auth-brand-mark" aria-hidden="true">
          <LockKeyhole />
        </div>
        <p className="auth-eyebrow">AUGI / ACCOUNT RECOVERY</p>
        <h1 id="reset-title">
          {stage === "request"
            ? "Recover your account."
            : "Choose a new password."}
        </h1>
        <p className="auth-description">
          {stage === "request"
            ? "Enter the email on your AUGI account and we will send a single-use recovery link."
            : "The recovery link verified you. Set the new password for your account."}
        </p>

        {stage === "request" ? (
          <form className="auth-form" onSubmit={requestLink}>
            <label className="auth-field" htmlFor="reset-email">
              <span>EMAIL ADDRESS</span>
              <div>
                <Mail aria-hidden="true" />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </label>
            {notice && (
              <p className="auth-description" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin-icon" aria-hidden="true" />
              ) : null}
              {busy ? "SENDING RECOVERY LINK" : "SEND RECOVERY LINK"}
              {!busy && <ArrowRight aria-hidden="true" />}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={setNewPassword}>
            <label className="auth-field" htmlFor="reset-password">
              <span>NEW PASSWORD</span>
              <div>
                <LockKeyhole aria-hidden="true" />
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin-icon" aria-hidden="true" />
              ) : null}
              {busy ? "UPDATING PASSWORD" : "SET NEW PASSWORD"}
              {!busy && <ArrowRight aria-hidden="true" />}
            </button>
          </form>
        )}

        <p className="auth-privacy">
          <LockKeyhole aria-hidden="true" />
          Recovery links are single-use and expire. AUGI never emails your
          password.
        </p>
      </section>
    </main>
  );
}
