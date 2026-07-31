import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audit Crucible Tracker",
  description:
    "Tracker progres audit CEM Fase 1 Bulan 4-6 dengan Next.js, Drizzle, dan PostgreSQL.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-[#0D0F14] text-white antialiased">{children}</body>
    </html>
  );
}
