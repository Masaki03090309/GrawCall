import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { Home, FolderKanban, Users, FileText } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isOwner = userData?.role === 'owner'

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                Zoom Phone Feedback
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Home className="h-4 w-4" />
                  ホーム
                </Link>
                <Link
                  href="/projects"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FolderKanban className="h-4 w-4" />
                  プロジェクト
                </Link>
                <Link
                  href="/prompts"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FileText className="h-4 w-4" />
                  プロンプト
                </Link>
                {isOwner && (
                  <Link
                    href="/users"
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Users className="h-4 w-4" />
                    ユーザー管理
                  </Link>
                )}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  )
}
