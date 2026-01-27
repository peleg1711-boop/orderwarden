import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import TopNav from "../components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrderGuard",
  description: "OrderGuard dashboard"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <TopNav />
          <main className="container">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
