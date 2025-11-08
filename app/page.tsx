import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'
import {
  FolderKanban,
  Users,
  BarChart3,
  FileText,
  Phone,
  MessageSquare,
  Settings,
  User
} from 'lucide-react'

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
  const isOwner = displayRole === 'owner'
  const isDirector = displayRole === 'director'
  const isUser = displayRole === 'user'

  // Define menu items with role-based visibility
  const menuItems = [
    {
      title: '通話履歴',
      description: '通話記録とフィードバック',
      icon: Phone,
      href: '/calls',
      color: 'text-green-600',
      visibleFor: ['owner', 'director', 'user'],
    },
    {
      title: 'プロジェクト',
      description: 'プロジェクトの管理とメンバー設定',
      icon: FolderKanban,
      href: '/projects',
      color: 'text-blue-600',
      visibleFor: ['owner', 'director'],
    },
    {
      title: 'プロンプト管理',
      description: 'AIフィードバック用プロンプトの設定',
      icon: MessageSquare,
      href: '/prompts',
      color: 'text-indigo-600',
      visibleFor: ['owner', 'director'],
    },
    {
      title: 'ユーザー管理',
      description: 'システム全体のユーザーロール管理',
      icon: Users,
      href: '/users',
      color: 'text-purple-600',
      visibleFor: ['owner'],
    },
    {
      title: 'システム設定',
      description: 'デフォルトプロンプトとシステム全体設定',
      icon: Settings,
      href: '/admin/default-prompts',
      color: 'text-gray-600',
      visibleFor: ['owner'],
    },
    {
      title: 'プロフィール',
      description: 'ユーザー情報の確認・編集',
      icon: User,
      href: '/profile',
      color: 'text-orange-600',
      visibleFor: ['owner', 'director', 'user'],
    },
  ]

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => item.visibleFor.includes(displayRole))

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
              <div className="flex items-center gap-2">
                <p className="font-medium capitalize">{displayRole}</p>
                {isOwner && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                    システムオーナー
                  </span>
                )}
                {isDirector && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    ディレクター
                  </span>
                )}
                {isUser && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                    ユーザー
                  </span>
                )}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Version 1.0.0 - Development Environment
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">メニュー</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleMenuItems.map((item) => (
              <Card
                key={item.href}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
              >
                <Link href={item.href}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg bg-gray-50 p-3 ${item.color}`}>
                        <item.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {item.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Link>
              </Card>
            ))}

            {/* Dashboard - Coming Soon */}
            <Card className="opacity-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-gray-400">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">ダッシュボード</CardTitle>
                    <CardDescription className="mt-1">
                      通話分析とKPI（開発中）
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
