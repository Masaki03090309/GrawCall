import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'
import { FolderKanban, Users, BarChart3, FileText } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user details from database - read only, no writes
  const { data: userData } = await supabase
    .from('users')
    .select('name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  // Use consistent fallback values to prevent hydration errors
  const displayName = userData?.name || user.email?.split('@')[0] || 'User'
  const displayEmail = userData?.email || user.email || ''
  const displayRole = userData?.role || 'user'
  const isOwner = userData?.role === 'owner'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Zoom Phone Feedback System</h1>
          <LogoutButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ようこそ、{displayName}さん</CardTitle>
            <CardDescription>
              AI-powered feedback system for Zoom Phone call recordings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">メールアドレス</p>
              <p className="font-medium">{displayEmail}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ロール</p>
              <p className="font-medium capitalize">{displayRole}</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Version 1.0.0 - Development Environment
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <Link href="/projects">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-blue-600" />
                  <CardTitle>プロジェクト</CardTitle>
                </div>
                <CardDescription>プロジェクトの管理とメンバー設定</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          {isOwner && (
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <Link href="/users">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <CardTitle>ユーザー管理</CardTitle>
                  </div>
                  <CardDescription>システム全体のユーザーロール管理</CardDescription>
                </CardHeader>
              </Link>
            </Card>
          )}

          <Card className="opacity-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-400" />
                <CardTitle>ダッシュボード</CardTitle>
              </div>
              <CardDescription>通話分析とKPI（開発中）</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-lg">
            <Link href="/calls">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <CardTitle>通話履歴</CardTitle>
                </div>
                <CardDescription>通話記録とフィードバック</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>
      </div>
    </main>
  )
}
