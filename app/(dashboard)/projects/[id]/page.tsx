'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Users,
  Settings,
  Phone
} from 'lucide-react'

interface Project {
  id: string
  name: string
  slack_webhook_url: string | null
  created_at: string
  updated_at: string
  project_members?: Array<{
    user_id: string
    role: string
    users: {
      id: string
      name: string
      email: string
      role: string
    }
  }>
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの取得に失敗しました')
      }

      setProject(result.data)
    } catch (err: any) {
      console.error('Error fetching project:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'プロジェクトが見つかりません'}</p>
            <Button onClick={() => router.push('/projects')} className="mt-4">
              プロジェクト一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const menuItems = [
    {
      title: 'トークスクリプト管理',
      description: 'トークスクリプトの作成・編集・履歴管理',
      icon: MessageSquare,
      href: `/projects/${projectId}/talk-scripts`,
      color: 'bg-blue-500',
    },
    {
      title: 'プロンプト管理',
      description: 'AIフィードバック用プロンプトの設定',
      icon: FileText,
      href: `/projects/${projectId}/prompts`,
      color: 'bg-green-500',
    },
    {
      title: 'メンバー一覧',
      description: 'プロジェクトメンバーの確認・管理',
      icon: Users,
      href: `/projects/${projectId}/members`,
      color: 'bg-purple-500',
    },
    {
      title: '通話履歴',
      description: 'プロジェクトの通話履歴を確認',
      icon: Phone,
      href: `/calls?project_id=${projectId}`,
      color: 'bg-orange-500',
    },
    {
      title: 'プロジェクト設定',
      description: 'プロジェクト名やSlack連携設定',
      icon: Settings,
      href: `/projects/${projectId}/settings`,
      color: 'bg-gray-500',
    },
  ]

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/projects')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          プロジェクト一覧に戻る
        </Button>

        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="mt-2 text-muted-foreground">
            プロジェクトの管理メニュー
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Card
            key={item.href}
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            onClick={() => router.push(item.href)}
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={`rounded-lg ${item.color} p-3 text-white`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {item.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>プロジェクト情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">プロジェクトID:</span>
              <span className="font-mono">{project.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">メンバー数:</span>
              <span>{project.project_members?.length || 0} 人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slack連携:</span>
              <span>{project.slack_webhook_url ? '設定済み ✓' : '未設定'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">作成日:</span>
              <span>{new Date(project.created_at).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
