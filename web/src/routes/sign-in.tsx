import { createFileRoute, redirect } from '@tanstack/react-router'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'

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

function SignIn() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="p-8 border rounded shadow-md">
        <h1 className="text-2xl mb-4 text-center">Sign In</h1>
        <GoogleSignInButton />
      </div>
    </div>
  )
}
