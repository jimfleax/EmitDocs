import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Balatro } from "@/components/ui/Balatro";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => {
    if (context.auth.session) {
      throw redirect({
        to: "/app",
      });
    }
  },
  component: SignIn,
});

const CURRENT_YEAR = new Date().getFullYear();

function SignIn() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col lg:grid lg:grid-cols-2">
      {/* Left Section: Branding, Supporting Text & Login Form */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 h-full min-h-[500px] lg:min-h-screen">
        {/* Branding */}
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="p-1 rounded-xl bg-white border border-slate-200/80 shadow-xs flex-none group-hover:scale-105 transition-transform">
              <img
                src="/favicon.svg"
                alt="EmitDocs"
                className="w-7 h-7 rounded-lg"
              />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">
              Emit<span className="text-blue-600">Docs</span>
            </span>
          </Link>
        </div>

        {/* Center: Sign-in Card */}
        <div className="w-full max-w-sm mx-auto my-auto py-12">
          <div className="space-y-2.5 mb-8 text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Sign in with your Google account to access your certificate
              templates, issuance batches, and documents.
            </p>
          </div>

          <div className="space-y-4">
            <GoogleSignInButton />
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              By continuing, you agree to EmitDocs'{" "}
              <a
                href="/terms"
                className="text-slate-600 hover:text-blue-600 underline underline-offset-2 transition-colors"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                className="text-slate-600 hover:text-blue-600 underline underline-offset-2 transition-colors"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>© {CURRENT_YEAR} EmitDocs. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="hover:text-slate-600 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="hover:text-slate-600 transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>

      {/* Right Section: Rounded container featuring <Balatro /> */}
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-full min-h-[420px] lg:min-h-screen">
        <div className="relative w-full h-full min-h-[400px] lg:min-h-[calc(100vh-4rem)] rounded-2xl md:rounded-3xl overflow-hidden border border-slate-200/80 shadow-md bg-slate-950">
          <Balatro
            isRotate={false}
            mouseInteraction={true}
            pixelFilter={700}
            color1="#6366F1"
            color2="#0037d2"
            color3="#eaeaea"
          />
        </div>
      </div>
    </div>
  );
}
