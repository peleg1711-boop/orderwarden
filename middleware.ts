import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Clerk session cookie (set by ClerkProvider)
  const hasSession = request.cookies.has("__session") || request.cookies.has("__clerk_db_jwt");

  // Signed-in users on sign-in/sign-up → redirect to dashboard
  if (hasSession && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Not signed in on root → redirect to landing page
  if (!hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("https://landing.orderwarden.com", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)"],
};
