import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/landing"],
  afterAuth(auth, req) {
    // If user is not signed in and trying to access root, redirect to landing page
    if (!auth.userId && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("https://landing.orderwarden.com", req.url));
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};