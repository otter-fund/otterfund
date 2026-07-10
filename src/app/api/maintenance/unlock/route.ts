import { NextResponse } from "next/server";
import {
  MAINTENANCE_COOKIE,
  MAINTENANCE_MAX_AGE,
  isMaintenanceMode,
  maintenanceToken,
  safeEqual,
} from "@/lib/maintenance";

// Validates the admin password and, on success, sets the bypass cookie so the
// proxy lets this browser through while maintenance mode stays on for everyone
// else. Reachable during maintenance (the proxy allow-lists this path).
export async function POST(request: Request) {
  if (!isMaintenanceMode()) {
    return NextResponse.json(
      { error: "Maintenance mode is not active." },
      { status: 400 },
    );
  }

  const configured = process.env.MAINTENANCE_PASSWORD;
  if (!configured) {
    return NextResponse.json(
      { error: "Team access is not configured for this environment." },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // Malformed body → empty password → fails the check below.
  }

  if (!safeEqual(password, configured)) {
    return NextResponse.json(
      { error: "That password is not correct." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(MAINTENANCE_COOKIE, await maintenanceToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAINTENANCE_MAX_AGE,
  });
  return response;
}
