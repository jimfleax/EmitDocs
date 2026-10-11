import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import TechText from '@/components/ui/TechText'
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
        <Link to="/sign-in">
          Get Started
        </Link>
      </Button>
    </div>
  )
}



