'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlusCircle, Users, Settings } from 'lucide-react'

interface Project {
  id: string
  name: string
  slack_webhook_url: string | null
  created_at: string
  updated_at: string
  project_members: Array<{
    user_id: string
    role: string
    users: {
      name: string
      email: string
    }
  }>
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/projects')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの取得に失敗しました')
      }

      setProjects(result.data.items)
    } catch (err: any) {
      console.error('Error fetching projects:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = () => {
    router.push('/projects/new')
  }

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`)
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

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchProjects} className="mt-4">
              再試行
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">プロジェクト</h1>
          <p className="mt-2 text-muted-foreground">プロジェクトを管理し、メンバーを招待します</p>
        </div>
        <Button onClick={handleCreateProject}>
          <PlusCircle className="mr-2 h-4 w-4" />
          新規プロジェクト
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="mb-4 text-muted-foreground">プロジェクトがありません</p>
            <Button onClick={handleCreateProject}>
              <PlusCircle className="mr-2 h-4 w-4" />
              最初のプロジェクトを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => {
            const memberCount = project.project_members?.length || 0
            const directorCount =
              project.project_members?.filter(m => m.role === 'director').length || 0

            return (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => handleProjectClick(project.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation()
                        router.push(`/projects/${project.id}/settings`)
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="mt-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {memberCount} メンバー ({directorCount} ディレクター)
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p>作成日: {new Date(project.created_at).toLocaleDateString('ja-JP')}</p>
                    {project.slack_webhook_url && <p className="mt-1">Slack通知: 有効</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
