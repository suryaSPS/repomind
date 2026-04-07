import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Incident Simulator",
  description: "Adaptive cybersecurity incident response training powered by Claude AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <header className="border-b border-[var(--card-border)] px-6 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold text-sm tracking-widest uppercase text-slate-300">
            CyberSim — AI Incident Simulator
          </span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
