"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function MfaManager({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/")
    ? params.get("next")!
    : "/account/security";
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollmentFactorId, setEnrollmentFactorId] = useState("");
  const [verifyingFactorId, setVerifyingFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [currentAal, setCurrentAal] = useState<"aal1" | "aal2">("aal1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, assurance] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const available = (data?.totp ?? []) as Factor[];
    setFactors(available);
    setCurrentAal(assurance.data?.currentLevel === "aal2" ? "aal2" : "aal1");
    if (
      isAdmin &&
      next.startsWith("/admin") &&
      assurance.data?.currentLevel !== "aal2"
    ) {
      const verified = available.find((factor) => factor.status === "verified");
      if (verified) setVerifyingFactorId(verified.id);
    }
  }, [isAdmin, next]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function enroll() {
    setBusy(true);
    setError("");
    const { data, error: enrollError } = await createClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: factors.length
        ? `Backup authenticator ${factors.length + 1}`
        : "Primary authenticator",
    });
    if (enrollError || !data)
      setError("We couldn't start authenticator setup. Please try again.");
    else {
      setEnrollmentFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setBusy(false);
  }

  async function verifySession(id: string) {
    if (!/^\d{6}$/.test(sessionCode)) {
      setError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const result = await supabase.auth.mfa.challengeAndVerify({
      factorId: id,
      code: sessionCode,
    });
    if (result.error)
      setError(
        "That code wasn't accepted. Wait for a fresh code and try again.",
      );
    else {
      setSessionCode("");
      await refresh();
      router.replace(next);
      router.refresh();
    }
    setBusy(false);
  }

  async function verifyEnrollment() {
    if (!/^\d{6}$/.test(enrollmentCode)) {
      setError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await createClient().auth.mfa.challengeAndVerify({
      factorId: enrollmentFactorId,
      code: enrollmentCode,
    });
    if (result.error)
      setError(
        "That code wasn't accepted. Wait for a fresh code and try again.",
      );
    else {
      setQr("");
      setSecret("");
      setEnrollmentCode("");
      setEnrollmentFactorId("");
      await refresh();
      router.refresh();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const target = factors.find((factor) => factor.id === id);
    if (
      isAdmin &&
      target?.status === "verified" &&
      factors.filter((factor) => factor.status === "verified").length <= 1
    ) {
      setError(
        "Administrators must keep at least one verified authenticator. Add a backup before removing this one.",
      );
      return;
    }
    setBusy(true);
    const result = await createClient().auth.mfa.unenroll({ factorId: id });
    if (result.error) setError("We couldn't remove that authenticator.");
    else await refresh();
    setBusy(false);
  }

  return (
    <section className="account-panel">
      <p className="eyebrow">Two-step verification</p>
      <h2>
        {isAdmin
          ? "Authenticator required for admin access"
          : "Authenticator app"}
      </h2>
      <p>
        Use an authenticator app to protect your account. Administrators must
        verify a current code before every sensitive session.
      </p>
      <div className={`security-assurance security-assurance--${currentAal}`}>
        {currentAal === "aal2" ? <ShieldCheck /> : <KeyRound />}
        <span>
          <strong>
            {currentAal === "aal2"
              ? "This session is verified"
              : "This session needs an authenticator code"}
          </strong>
          <small>
            {currentAal === "aal2"
              ? "Sensitive account and admin actions are available."
              : "Verify one of your enrolled authenticators below to continue."}
          </small>
        </span>
      </div>
      {factors.map((factor) => (
        <article className="security-factor" key={factor.id}>
          <div className="security-factor__summary">
            <CheckCircle2 aria-hidden="true" />
            <span>
              <strong>{factor.friendly_name ?? "Authenticator"}</strong>
              <small>
                {factor.status === "verified"
                  ? "Verified authenticator"
                  : factor.status}
              </small>
            </span>
          </div>
          {factor.status === "verified" ? (
            <div className="security-factor__actions">
              <button
                className="secondary-action"
                onClick={() => {
                  setVerifyingFactorId(factor.id);
                  setError("");
                }}
                type="button"
              >
                Verify this session
              </button>
              <button
                aria-label={`Remove ${factor.friendly_name ?? "authenticator"}`}
                className="text-button text-button--danger"
                disabled={busy}
                onClick={() => remove(factor.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} /> Remove
              </button>
            </div>
          ) : (
            <button
              className="text-button text-button--danger"
              disabled={busy}
              onClick={() => remove(factor.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} /> Remove incomplete setup
            </button>
          )}
          {verifyingFactorId === factor.id ? (
            <form
              className="mfa-session-form"
              onSubmit={(event) => {
                event.preventDefault();
                void verifySession(factor.id);
              }}
            >
              <label className="form-field">
                <span>Current 6-digit code</span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    setSessionCode(event.target.value.replace(/\D/g, ""))
                  }
                  pattern="[0-9]{6}"
                  required
                  value={sessionCode}
                />
              </label>
              <div className="button-row">
                <button
                  className="primary-action"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Verifying…" : "Verify code"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setVerifyingFactorId("")}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </article>
      ))}
      {!qr ? (
        <button
          className="primary-action"
          disabled={busy}
          onClick={enroll}
          type="button"
        >
          <Plus aria-hidden="true" size={17} /> Add authenticator
        </button>
      ) : (
        <div className="mfa-enrolment">
          <Image
            alt="Authenticator setup QR code"
            height="220"
            src={qr}
            unoptimized
            width="220"
          />
          <p>
            Scan the QR code. If scanning is unavailable, enter this key:{" "}
            <code>{secret}</code>
          </p>
          <label className="form-field">
            <span>6-digit code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(e) =>
                setEnrollmentCode(e.target.value.replace(/\D/g, ""))
              }
              pattern="[0-9]{6}"
              required
              value={enrollmentCode}
            />
          </label>
          <button
            className="primary-action"
            disabled={busy}
            onClick={verifyEnrollment}
            type="button"
          >
            Verify and add authenticator
          </button>
        </div>
      )}
      <p className="form-help">
        For admin recovery, add a second verified TOTP factor on a separate
        trusted authenticator/device. Supabase TOTP does not use traditional
        recovery codes.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
