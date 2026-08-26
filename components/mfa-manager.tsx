"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function MfaManager({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/")
    ? params.get("next")!
    : "/account/security";
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setBusy(false);
  }

  async function verify(id = factorId) {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: id });
    if (challenge.error || !challenge.data)
      setError("We couldn't start verification. Please try again.");
    else {
      const result = await supabase.auth.mfa.verify({
        factorId: id,
        challengeId: challenge.data.id,
        code,
      });
      if (result.error)
        setError(
          "That code wasn't accepted. Wait for a fresh code and try again.",
        );
      else {
        await refresh();
        router.replace(next);
        router.refresh();
      }
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (
      isAdmin &&
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
      {factors.map((factor) => (
        <div className="security-factor" key={factor.id}>
          <span>
            <strong>{factor.friendly_name ?? "Authenticator"}</strong>
            <small>{factor.status}</small>
          </span>
          {factor.status === "verified" ? (
            <>
              <button
                className="secondary-action"
                onClick={() => verify(factor.id)}
                type="button"
              >
                Verify this session
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => remove(factor.id)}
                type="button"
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      ))}
      {!qr ? (
        <button
          className="primary-action"
          disabled={busy}
          onClick={enroll}
          type="button"
        >
          Add authenticator
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
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              value={code}
            />
          </label>
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => verify()}
            type="button"
          >
            Verify authenticator
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
