import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const hasSession =
      request.cookies.has("__session") ||
      request.cookies.has("__clerk_db_jwt");

    if (hasSession) {
      return NextResponse.rewrite(new URL("/dashboard", request.url));
    }
    return NextResponse.rewrite(new URL("/landing.html", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
