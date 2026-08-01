import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditSettings } from "@/db/schema";

const LOGIN_RATE_LIMIT_KEY = "login_rate_limit";
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type LoginRateLimitState = {
  failedCount: number;
  windowStart: string;
  lockedUntil?: string;
};

function parseState(value: string | undefined): LoginRateLimitState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<LoginRateLimitState>;
    const failedCount = Number(parsed.failedCount);
    const windowStart = typeof parsed.windowStart === "string" ? parsed.windowStart : "";
    const lockedUntil = typeof parsed.lockedUntil === "string" ? parsed.lockedUntil : undefined;

    if (!Number.isFinite(failedCount) || failedCount < 0 || Number.isNaN(Date.parse(windowStart))) {
      return null;
    }

    return {
      failedCount,
      windowStart,
      lockedUntil,
    };
  } catch {
    return null;
  }
}

async function getRateLimitState(): Promise<LoginRateLimitState | null> {
  const rows = await db
    .select({ value: auditSettings.value })
    .from(auditSettings)
    .where(eq(auditSettings.key, LOGIN_RATE_LIMIT_KEY))
    .limit(1);

  return parseState(rows[0]?.value);
}

async function saveRateLimitState(state: LoginRateLimitState): Promise<void> {
  const now = new Date();

  await db
    .insert(auditSettings)
    .values({
      key: LOGIN_RATE_LIMIT_KEY,
      value: JSON.stringify(state),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: auditSettings.key,
      set: {
        value: JSON.stringify(state),
        updatedAt: now,
      },
    });
}

function isWindowExpired(state: LoginRateLimitState, now: Date): boolean {
  return now.getTime() - new Date(state.windowStart).getTime() >= WINDOW_MS;
}

function getRetryAfterSeconds(lockedUntil: string, now: Date): number {
  return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - now.getTime()) / 1000));
}

export async function checkLoginLockout(): Promise<{
  locked: boolean;
  retryAfterSeconds?: number;
}> {
  const state = await getRateLimitState();

  if (!state?.lockedUntil) {
    return { locked: false };
  }

  const now = new Date();

  if (new Date(state.lockedUntil).getTime() > now.getTime()) {
    return {
      locked: true,
      retryAfterSeconds: getRetryAfterSeconds(state.lockedUntil, now),
    };
  }

  return { locked: false };
}

export async function recordFailedLoginAttempt(): Promise<void> {
  const now = new Date();
  const state = await getRateLimitState();

  if (!state || isWindowExpired(state, now)) {
    await saveRateLimitState({
      failedCount: 1,
      windowStart: now.toISOString(),
    });
    return;
  }

  if (state.lockedUntil && new Date(state.lockedUntil).getTime() > now.getTime()) {
    return;
  }

  const failedCount = state.failedCount + 1;
  const nextState: LoginRateLimitState = {
    failedCount,
    windowStart: state.windowStart,
  };

  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    nextState.lockedUntil = new Date(now.getTime() + LOCKOUT_MS).toISOString();
  }

  await saveRateLimitState(nextState);
}

export async function resetLoginAttempts(): Promise<void> {
  await db.delete(auditSettings).where(eq(auditSettings.key, LOGIN_RATE_LIMIT_KEY));
}
