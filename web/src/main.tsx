import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { AuthProvider, useAuth } from './lib/auth-context'
import './index.css'

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be injected by the provider
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// @ts-ignore
// eslint-disable-next-line react-refresh/only-export-components
function InnerApp() {
  const auth = useAuth()
  
  if (auth.isPending) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-900">Loading...</div>
  }

  return <RouterProvider router={router} context={{ auth }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  </StrictMode>,
)
