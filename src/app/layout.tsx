import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, Manrope, DM_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import { resolveAppConfig } from "@/lib/config";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-syne",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian Tribunal — AI-Rendered On-Chain Justice",
  description:
    "A decentralized dispute resolution protocol. File a case, mount a defense, stake on the outcome, and let AI validators deliver impartial verdicts through optimistic consensus.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Runtime configuration resolves on the server from plain (non-public)
  // environment variables and flows into the client tree via context —
  // nothing is inlined into the browser bundle.
  const config = resolveAppConfig();

  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${manrope.variable} ${dmMono.variable} font-sans antialiased`}
      >
        <Providers config={config}>{children}</Providers>
      </body>
    </html>
  );
}
