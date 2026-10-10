import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.auth.session) {
      throw redirect({
        to: '/app',
      })
    }
  },
  component: Index,
})

function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground space-y-8 p-4">
      <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
        <span className="text-foreground">Emit</span>
        <span className="text-blue-600">Docs</span>
      </h1>
      <Link to="/sign-in">
        <Button size="lg" className="px-8 py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white">
          Log In
        </Button>
      </Link>
    </div>
  )
}
