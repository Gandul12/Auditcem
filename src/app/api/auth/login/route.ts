import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, isAdminPasswordConfigured, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD belum dikonfigurasi di environment." },
      { status: 500 },
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

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Password admin salah." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, createSessionToken());

  return response;
}
