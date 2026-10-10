import { authClient } from '../../lib/auth-client'

export function GoogleSignInButton() {
  const handleSignIn = async () => {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/app' })
  }

  return (
    <button
      onClick={handleSignIn}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
    >
      Sign in with Google
    </button>
  )
}
