import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/landing", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware((auth, req) => {
  const { userId } = auth();

  // If user is signed in and on sign-in/sign-up page, redirect to dashboard
  if (userId && (req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If user is not signed in and trying to access root, redirect to landing page
  if (!userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("https://landing.orderwarden.com", req.url));
  }

  // Protect non-public routes
  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("https://landing.orderwarden.com", req.url));
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
