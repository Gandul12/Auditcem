import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "audit_crucible_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  sub: "admin";
  iat: number;
  nonce: string;
};

function getSessionSecret(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

export function createSessionToken(): string {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("ADMIN_PASSWORD is required to create an admin session.");
  }

  const payload: SessionPayload = {
    sub: "admin",
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string): boolean {
  const secret = getSessionSecret();

  if (!secret || !token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = sign(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    const ageInSeconds = (Date.now() - Number(payload.iat)) / 1000;

    return payload.sub === "admin" && Number.isFinite(ageInSeconds) && ageInSeconds <= SESSION_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function requireAuthenticatedRequest(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (verifySessionToken(token)) {
    return null;
  }

  return NextResponse.json({ error: "Sesi admin tidak valid atau sudah kedaluwarsa." }, { status: 401 });
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(getSessionSecret());
}
