/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import { authClient } from './auth-client'

export type SessionContextType = typeof authClient.$Infer.Session

type AuthContextType = {
  session: SessionContextType['session'] | null
  user: SessionContextType['user'] | null
  isPending: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession()

  return (
    <AuthContext.Provider
      value={{
        session: data?.session || null,
        user: data?.user || null,
        isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
