/**
 * @file AppShell.tsx
 * @description Primary application shell layout with responsive sidebar navigation, user session badge, and route container.
 * @architecture Wraps all authenticated routes under /app/*, providing fixed navigation planes and sign-out controls.
 */

import React, { useState } from "react";
import { useLocation, Link } from "@tanstack/react-router";
import { SignOut, House, FileText, Stack } from "@phosphor-icons/react";
import { authClient } from "../../lib/auth-client";
import { OfflineIndicator } from "../pwa";

/**
 * @component AppShell
 * @description Master authenticated layout frame with responsive navigation planes and session profile controls.
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} [props.children] - Page content rendered in the main scrollable workspace canvas.
 * @state Tracks active sign-out progress and resolves current route pathnames.
 * @api Interacts with authClient.useSession() and authClient.signOut().
 */
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;

  const isHomeActive = pathname === "/app" || pathname === "/app/";
  const isTemplatesActive = pathname.startsWith("/app/templates");
  const isBatchesActive = pathname.startsWith("/app/batches");
  const isEditorRoute = pathname.includes("/versions/");

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/sign-in";
          },
        },
      });
    } catch (error) {
      console.error("Sign-out error:", error);
      window.location.href = "/sign-in";
    } finally {
      setIsSigningOut(false);
    }
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="relative min-h-screen h-screen flex flex-col lg:flex-row p-3 lg:p-4 gap-4 overflow-hidden bg-[rgb(16_60_133)] text-white">
      {/* Ambient background glows for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-indigo-400/15 blur-3xl"
      />

      {/* Mobile & Tablet Top Bar (< lg) */}
      <header className="lg:hidden flex flex-col gap-3 p-3 bg-white/[0.08] backdrop-blur-xl rounded-2xl shrink-0 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.2)]">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-xl bg-white shadow-xs border border-white/30 flex-none">
              <img
                src="/favicon.svg"
                alt="EmitDocs"
                className="w-6 h-6 rounded-lg"
              />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white drop-shadow-xs">
              Emit<span className="text-blue-300">Docs</span>
            </span>
            <OfflineIndicator />
          </div>

          {/* Compact Account Info & Sign Out */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={userName}
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/30 flex-none shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/30 flex-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]">
                  {userInitial}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white truncate max-w-[120px]">
                  {userName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/15 border border-transparent hover:border-white/20 backdrop-blur-md transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              <SignOut size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Text List */}
        <div className="flex items-center gap-5 overflow-x-auto pb-0.5 px-1 scrollbar-none">
          <Link
            to="/app"
            className={`flex items-center gap-2 text-sm tracking-tight cursor-pointer select-none shrink-0 transition-colors ${
              isHomeActive
                ? "font-black text-white"
                : "font-bold text-white/55 hover:text-white"
            }`}
          >
            <House
              size={16}
              weight="bold"
              className={`shrink-0 ${isHomeActive ? "text-white" : "text-white/55"}`}
            />
            <span className="translate-y-[1px]">Home</span>
          </Link>

          <Link
            to="/app/templates"
            className={`flex items-center gap-2 text-sm tracking-tight cursor-pointer select-none shrink-0 transition-colors ${
              isTemplatesActive
                ? "font-black text-white"
                : "font-bold text-white/55 hover:text-white"
            }`}
          >
            <FileText
              size={16}
              weight="bold"
              className={`shrink-0 ${isTemplatesActive ? "text-white" : "text-white/55"}`}
            />
            <span className="translate-y-[1px]">Templates</span>
          </Link>

          <Link
            to="/app/batches"
            className={`flex items-center gap-2 text-sm tracking-tight cursor-pointer select-none shrink-0 transition-colors ${
              isBatchesActive
                ? "font-black text-white"
                : "font-bold text-white/55 hover:text-white"
            }`}
          >
            <Stack
              size={16}
              weight="bold"
              className={`shrink-0 ${isBatchesActive ? "text-white" : "text-white/55"}`}
            />
            <span className="translate-y-[1px]">Batches</span>
          </Link>
        </div>
      </header>

      {/* Desktop Left Navigation Plane (Fixed width on lg+) */}
      <aside className="hidden lg:flex w-56 xl:w-64 flex-col justify-between p-4 lg:p-6 shrink-0 h-full relative z-10">
        {/* Top Section */}
        <div className="space-y-10">
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-2xl bg-white shadow-md border border-white/30 flex-none">
                <img
                  src="/favicon.svg"
                  alt="EmitDocs"
                  className="w-7 h-7 rounded-xl"
                />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white drop-shadow-xs">
                Emit<span className="text-blue-300">Docs</span>
              </span>
            </div>
            <OfflineIndicator />
          </div>

          {/* Navigation Text List matching Figma style */}
          <nav className="flex flex-col space-y-6 pl-1">
            {/* Home */}
            <Link
              to="/app"
              className={`flex items-center gap-3 w-full text-left tracking-tight cursor-pointer select-none transition-colors duration-200 group ${
                isHomeActive
                  ? "text-xl font-black text-white"
                  : "text-base font-bold text-white/50 hover:text-white"
              }`}
            >
              <House
                size={isHomeActive ? 22 : 20}
                weight="bold"
                className={`shrink-0 ${
                  isHomeActive
                    ? "text-white"
                    : "text-white/50 group-hover:text-white transition-colors"
                }`}
              />
              <span
                className={
                  isHomeActive ? "translate-y-[2px]" : "translate-y-[1.5px]"
                }
              >
                Home
              </span>
            </Link>

            {/* Templates */}
            <Link
              to="/app/templates"
              className={`flex items-center gap-3 w-full text-left tracking-tight cursor-pointer select-none transition-colors duration-200 group ${
                isTemplatesActive
                  ? "text-xl font-black text-white"
                  : "text-base font-bold text-white/50 hover:text-white"
              }`}
            >
              <FileText
                size={isTemplatesActive ? 22 : 20}
                weight="bold"
                className={`shrink-0 ${
                  isTemplatesActive
                    ? "text-white"
                    : "text-white/50 group-hover:text-white transition-colors"
                }`}
              />
              <span
                className={
                  isTemplatesActive
                    ? "translate-y-[2px]"
                    : "translate-y-[1.5px]"
                }
              >
                Templates
              </span>
            </Link>

            <Link
              to="/app/batches"
              className={`flex items-center gap-3 w-full text-left tracking-tight cursor-pointer select-none transition-colors duration-200 group ${
                isBatchesActive
                  ? "text-xl font-black text-white"
                  : "text-base font-bold text-white/50 hover:text-white"
              }`}
            >
              <Stack
                size={isBatchesActive ? 22 : 20}
                weight="bold"
                className={`shrink-0 ${
                  isBatchesActive
                    ? "text-white"
                    : "text-white/50 group-hover:text-white transition-colors"
                }`}
              />
              <span
                className={
                  isBatchesActive ? "translate-y-[2px]" : "translate-y-[1.5px]"
                }
              >
                Batches
              </span>
            </Link>
          </nav>
        </div>

        {/* Bottom Section: Account Banner */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2.5 min-w-0 w-full px-1">
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={userName}
                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/20 flex-none shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md text-white flex items-center justify-center font-bold text-sm ring-1 ring-white/25 flex-none shadow-inner">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm font-bold text-white truncate block leading-tight">
                  {userName}
                </p>
                <p className="text-xs font-light text-white/60 truncate block leading-tight mt-0.5">
                  {userEmail || "Signed in"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer flex-none"
            >
              <SignOut size={18} weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right Main Container (Full remaining flex width on lg+) */}
      <main
        className={`flex-1 min-w-0 min-h-0 w-full h-full bg-white/95 backdrop-blur-2xl rounded-3xl lg:rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.25)] text-gray-900 border border-white/40 ring-1 ring-black/5 relative z-10 transition-all ${
          isEditorRoute
            ? "p-0 overflow-hidden"
            : isHomeActive
              ? "p-6 lg:p-10 overflow-hidden"
              : "p-6 lg:p-10 overflow-y-auto"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
