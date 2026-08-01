"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
      };

      if (!response.ok) {
        const retryMessage =
          response.status === 429 && payload.retryAfterSeconds
            ? ` Coba lagi dalam ${Math.max(1, Math.ceil(payload.retryAfterSeconds / 60))} menit.`
            : "";
        throw new Error(payload.error ?? `Login gagal.${retryMessage}`);
      }

      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-[28px] border border-white/[0.07] bg-[#13161E]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
    >
      <div className="mb-8">
        <div className="mb-5 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
          Admin Session
        </div>
        <h1 className="font-heading text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          Audit Crucible Tracker
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Masuk dengan satu password admin dari environment variable untuk membuka dashboard sertifikasi CEM.
        </p>
      </div>

      <label className="text-xs font-bold uppercase tracking-[0.18em] text-white/45" htmlFor="password">
        ADMIN_PASSWORD
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Masukkan password admin"
        className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-[#0D0F14] px-4 py-3 text-base text-white outline-none transition focus:border-amber-300/70 focus:ring-4 focus:ring-amber-300/10"
        autoComplete="current-password"
        required
      />

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-2xl bg-[#F5A623] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#0D0F14] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Memverifikasi..." : "Masuk Dashboard"}
      </button>

      <p className="mt-5 text-xs leading-5 text-white/40">
        Session disimpan sebagai cookie httpOnly selama 7 hari. Tidak ada data audit yang disimpan di browser.
      </p>
    </form>
  );
}
