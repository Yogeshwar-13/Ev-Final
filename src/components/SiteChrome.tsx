import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMapActive = pathname === "/map";
  const isListActive = pathname.startsWith("/stations") || pathname.startsWith("/station");
  const isConnectorsActive = pathname === "/connectors" || pathname.startsWith("/connector");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground transition-colors duration-300">
      {/* Ambient gradient light - Electric Cyan & Sapphire Blue */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient-glow -top-32 -left-28 h-[540px] w-[540px] bg-[#0284c7]/25 blur-[140px]" />
        <div className="ambient-glow top-1/3 -right-24 h-[500px] w-[500px] bg-[#0ea5e9]/20 blur-[140px]" />
        <div className="ambient-glow -bottom-36 left-1/3 h-[540px] w-[540px] bg-[#38bdf8]/15 blur-[150px]" />
      </div>

      {/* Kinetic diagonal frosted strips */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-24 left-[8%] h-72 w-40 -skew-x-12 rounded-3xl bg-[#0ea5e9]/[0.04] backdrop-blur-xl border border-border shadow-lg shadow-accent/5" />
        <div className="absolute top-1/2 right-[12%] h-96 w-48 -skew-x-12 rounded-3xl bg-[#38bdf8]/[0.04] backdrop-blur-xl border border-border shadow-lg shadow-accent/5" />
        <div className="absolute bottom-10 left-[36%] h-56 w-32 -skew-x-12 rounded-3xl bg-[#0284c7]/[0.03] backdrop-blur-xl border border-border shadow-md shadow-accent/5" />
      </div>

      <div className="relative">
        <header className="flex flex-wrap items-center justify-between px-6 sm:px-8 lg:px-14 py-4 border-b border-border/50 bg-background/40 backdrop-blur-md sticky top-0 z-50">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="grid size-9 place-items-center rounded-xl charge-button font-display font-black shadow-md shadow-accent/20">
              ⚡
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">EvFinder</span>
          </Link>
          <nav
            id="primary-navigation"
            className={`${isMobileMenuOpen ? "flex" : "hidden"} order-3 w-full flex-col items-stretch gap-2 pt-3 text-sm font-semibold md:order-none md:flex md:w-auto md:flex-row md:items-center md:pt-0`}
          >
            <Link
              to="/map"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isMapActive
                  ? "bg-accent/15 text-accent border border-accent/40 font-bold shadow-sm shadow-accent/10"
                  : "text-frost/70 hover:text-foreground hover:bg-ink2/60 border border-transparent"
              }`}
            >
              {isMapActive && <span className="size-2 rounded-full bg-accent animate-pulse" />}
              Map View
            </Link>
            <Link
              to="/stations"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isListActive
                  ? "bg-accent/15 text-accent border border-accent/40 font-bold shadow-sm shadow-accent/10"
                  : "text-frost/70 hover:text-foreground hover:bg-ink2/60 border border-transparent"
              }`}
            >
              {isListActive && <span className="size-2 rounded-full bg-accent animate-pulse" />}
              List View
            </Link>
            <Link
              to="/connectors"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isConnectorsActive
                  ? "bg-accent/15 text-accent border border-accent/40 font-bold shadow-sm shadow-accent/10"
                  : "text-frost/70 hover:text-foreground hover:bg-ink2/60 border border-transparent"
              }`}
            >
              {isConnectorsActive && (
                <span className="size-2 rounded-full bg-accent animate-pulse" />
              )}
              Connector Guide
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="primary-navigation"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-ink2/80 text-foreground transition hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
            >
              {isMobileMenuOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </header>

        {children}

        <footer className="px-6 sm:px-8 lg:px-14 pb-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-8 text-sm text-frost/60">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-foreground">EvFinder India</span>
            <span className="text-xs text-frost/50">· OpenStreetMap Powered</span>
            <ThemeToggle className="size-7 rounded-lg text-xs" />
          </div>
          <div className="flex flex-wrap gap-6 text-xs sm:text-sm font-medium">
            <Link
              to="/map"
              className={`transition ${isMapActive ? "text-accent font-bold underline" : "text-frost/70 hover:text-foreground"}`}
            >
              Map View
            </Link>
            <Link
              to="/stations"
              className={`transition ${isListActive ? "text-accent font-bold underline" : "text-frost/70 hover:text-foreground"}`}
            >
              List View
            </Link>
            <Link
              to="/connectors"
              className={`transition ${isConnectorsActive ? "text-accent font-bold underline" : "text-frost/70 hover:text-foreground"}`}
            >
              Connector Guide
            </Link>
          </div>
          <span>© 2026 EvFinder Energy</span>
        </footer>
      </div>
    </div>
  );
}
