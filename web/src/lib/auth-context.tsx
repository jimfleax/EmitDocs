/**
 * @file auth-context.tsx
 * @description React Context and Hook providing authentication session and user state.
 * @architecture Wraps the application tree to supply reactive auth credentials obtained from authClient.
 * @agent_note Use useAuth() in protected routes and components to access session and user state.
 */

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import { authClient } from "./auth-client";

export type SessionContextType = typeof authClient.$Infer.Session;

type AuthContextType = {
  session: SessionContextType["session"] | null;
  user: SessionContextType["user"] | null;
  isPending: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * @component AuthProvider
 * @description Provides authentication state context to child components.
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - Child elements wrapped by auth provider.
 * @api Interacts with authClient.useSession() for real-time authentication updates.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();

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
  );
}

/**
 * @hook useAuth
 * @description Accesses the current authentication context containing session, user, and pending state.
 * @returns {AuthContextType} Active session, current user, and pending loading status.
 * @throws {Error} If called outside of an AuthProvider hierarchy.
 * @sideeffects Subscribes to AuthContext updates from AuthProvider without external network side-effects.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
