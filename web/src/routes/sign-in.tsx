import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Balatro } from '@/components/ui/Balatro'

export const Route = createFileRoute('/sign-in')({
  beforeLoad: ({ context }) => {
    if (context.auth.session) {
      throw redirect({
        to: '/app',
      })
    }
  },
  component: SignIn,
})

const CURRENT_YEAR = new Date().getFullYear()

function SignIn() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col lg:grid lg:grid-cols-2">
      {/* Left Section: Branding, Supporting Text & Login Form */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 h-full min-h-[500px] lg:min-h-screen">
        {/* Branding */}
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <img
              src="/favicon.svg"
              alt="EmitDocs"
              className="w-9 h-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform flex-none"
            />
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
              Sign in with your Google account to access your certificate templates, issuance batches, and documents.
            </p>
          </div>

          <div className="space-y-4">
            <GoogleSignInButton />
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              By continuing, you agree to EmitDocs' Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-slate-400">
          © {CURRENT_YEAR} EmitDocs. All rights reserved.
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
  )
}
