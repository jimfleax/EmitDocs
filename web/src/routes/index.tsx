/**
 * @file index.tsx
 * @description Public marketing landing page displaying animated brand headers and entry links.
 * @architecture Public route redirecting authenticated users to /app and rendering landing visuals for guests.
 * @agent_note In beforeLoad, checks context.auth.session and redirects active sessions to /app.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import TechText from "@/components/ui/TechText";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.auth.session) {
      throw redirect({
        to: "/app",
      });
    }
  },
  component: Index,
});

const CURRENT_YEAR = new Date().getFullYear();

/**
 * @component Index
 * @description Landing page view featuring stylized logo animations and registration CTA buttons.
 * @returns {JSX.Element} Landing hero page.
 */
function Index() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground justify-between p-4 sm:p-6">
      <div />

      <div className="flex flex-col items-center justify-center space-y-8 my-auto">
        <div className="w-full max-w-4xl h-[360px] md:h-[480px] relative bg-transparent overflow-hidden flex items-center justify-center p-4">
          <TechText
            text="EmitDocs"
            fontWeight={700}
            fontSize={140}
            color="#000000"
            accentColor="#3b82f6"
            reveal="letter"
            dashLength={4}
            dashGap={2}
            specks={15}
          />
        </div>

        <Button
          asChild
          size="lg"
          className="h-12 px-8 rounded-[18px] bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] font-medium shadow-[0_10px_24px_-14px_rgba(0,0,0,0.45)] transition-all duration-200 active:scale-[0.98]"
        >
          <Link to="/sign-in">Get Started</Link>
        </Button>
      </div>

      <footer className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 py-4 border-t border-slate-100">
        <div>© {CURRENT_YEAR} EmitDocs. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <Link to="/terms" className="hover:text-slate-600 transition-colors">
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="hover:text-slate-600 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            to="/sign-in"
            className="hover:text-slate-600 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
}
