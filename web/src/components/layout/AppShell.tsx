import { authClient } from '../../lib/auth-client'

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/sign-in';
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="flex justify-between items-center bg-white p-4 shadow rounded mb-4">
        <h1 className="text-xl font-bold">EmitDocs App</h1>
        <div className="flex items-center gap-4">
          <span>{session?.user?.name || session?.user?.email}</span>
          <button
            onClick={handleSignOut}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="bg-white p-4 shadow rounded min-h-[500px]">
        {children}
      </main>
    </div>
  )
}
