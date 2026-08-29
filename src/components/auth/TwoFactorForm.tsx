"use client";

import React, { useEffect, useRef, useState } from "react";
import Alert from "@/components/ui/alert/SimpleAlert";
import { AdminLoginChallengeResponse } from "@/types/auth";

const OTP_LENGTH = 6;

interface TwoFactorFormProps {
  email: string;
  challenge: AdminLoginChallengeResponse;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}

export default function TwoFactorForm({
  email,
  challenge,
  onVerify,
  onResend,
  onBack,
}: TwoFactorFormProps) {
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(challenge.expires_in);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setSecondsLeft(challenge.expires_in);
    setCode("");
    inputRefs.current[0]?.focus();
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge.challenge_id, challenge.expires_in]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the complete six-digit code.");
      return;
    }
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const setDigit = (index: number, digit: string) => {
    const digits = code.padEnd(OTP_LENGTH, " ").split("");
    digits[index] = digit;
    setCode(digits.join("").trimEnd());
  };

  const handleDigitChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, "");
    if (!value) {
      setDigit(index, "");
      return;
    }
    const chars = value.split("");
    const digits = code.padEnd(OTP_LENGTH, " ").split("");
    let cursor = index;
    for (const char of chars) {
      if (cursor >= OTP_LENGTH) break;
      digits[cursor] = char;
      cursor += 1;
    }
    setCode(digits.join("").trimEnd());
    const next = Math.min(cursor, OTP_LENGTH - 1);
    inputRefs.current[next]?.focus();
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (code[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        inputRefs.current[index - 1]?.focus();
      }
      event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      event.preventDefault();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      event.preventDefault();
    }
  };

  const handleDigitPaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    handleDigitChange(index, { target: { value: pasted } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      await onResend();
      setNotice("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend the code");
    } finally {
      setIsLoading(false);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div>
      <div className="mb-5 sm:mb-8">
        <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
          Check your email
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter the six-digit code sent to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <span id="admin-2fa-label" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification code
          </span>
          <div role="group" aria-labelledby="admin-2fa-label" className="flex justify-between gap-2">
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={code[index] ?? ""}
                onChange={(event) => handleDigitChange(index, event)}
                onKeyDown={(event) => handleDigitKeyDown(index, event)}
                onPaste={(event) => handleDigitPaste(index, event)}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                autoFocus={index === 0}
                disabled={isLoading || secondsLeft === 0}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                aria-describedby="admin-2fa-expiry"
                className="h-14 w-full rounded-lg border border-gray-300 bg-transparent text-center font-mono text-2xl text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            ))}
          </div>
          <p id="admin-2fa-expiry" className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            {secondsLeft > 0 ? `Code expires in ${minutes}:${seconds}` : "This code has expired. Resend a new code."}
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || secondsLeft === 0 || code.length !== 6}
          className="w-full rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {isLoading ? "Verifying..." : "Verify and sign in"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} disabled={isLoading} className="text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200">
            Wrong email? Go back
          </button>
          <button type="button" onClick={handleResend} disabled={isLoading} className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400">
            Resend code
          </button>
        </div>
      </form>
    </div>
  );
}
