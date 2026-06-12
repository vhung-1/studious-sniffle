import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Kalshi Intel — Market Activity",
  description:
    "Bloomberg-style Kalshi market intelligence: trade flow, volume analytics, and block-trade discovery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
            <div className="container flex h-14 items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Kalshi Intel</span>
                </Link>
                <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-foreground">
                    Dashboard
                  </Link>
                  <Link href="/markets" className="hover:text-foreground">
                    Markets
                  </Link>
                </nav>
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="container py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
