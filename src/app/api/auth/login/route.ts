import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  isAdminPasswordConfigured,
  safeEqual,
  setSessionCookie,
} from "@/lib/auth";
import {
  checkLoginLockout,
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from "@/lib/loginRateLimit";

export const dynamic = "force-dynamic";

function formatRetryAfter(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `${minutes} menit`;
}

export async function POST(request: NextRequest) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD belum dikonfigurasi di environment." },
      { status: 500 },
    );
  }

  const lockout = await checkLoginLockout();

  if (lockout.locked) {
    const retryAfterSeconds = lockout.retryAfterSeconds ?? 60;
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${formatRetryAfter(retryAfterSeconds)}.`,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload login tidak valid." }, { status: 400 });
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as { password?: unknown }).password ?? "")
      : "";

  if (!safeEqual(password, process.env.ADMIN_PASSWORD ?? "")) {
    await recordFailedLoginAttempt();
    return NextResponse.json({ error: "Password admin salah." }, { status: 401 });
  }

  await resetLoginAttempts();

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, createSessionToken());

  return response;
}
