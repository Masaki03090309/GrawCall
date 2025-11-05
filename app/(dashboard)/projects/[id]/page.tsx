'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Trash2, Users } from 'lucide-react'

interface Member {
  user_id: string
  role: string
  created_at: string
  users: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface Project {
  id: string
  name: string
  slack_webhook_url: string | null
  created_at: string
  updated_at: string
  project_members: Member[]
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slack_webhook_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/projects/${projectId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの取得に失敗しました')
      }

      setProject(result.data)
      setFormData({
        name: result.data.name,
        slack_webhook_url: result.data.slack_webhook_url || '',
      })
    } catch (err: any) {
      console.error('Error fetching project:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          slack_webhook_url: formData.slack_webhook_url || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの更新に失敗しました')
      }

      setProject(result.data)
      alert('プロジェクトを更新しました')
    } catch (err: any) {
      console.error('Error updating project:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの削除に失敗しました')
      }

      router.push('/projects')
    } catch (err: any) {
      console.error('Error deleting project:', err)
      setError(err.message)
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleManageMembers = () => {
    router.push(`/projects/${projectId}/members`)
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

  if (error && !project) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.push('/projects')} className="mt-4">
              プロジェクト一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const memberCount = project?.project_members?.length || 0
  const directorCount = project?.project_members?.filter(m => m.role === 'director').length || 0

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/projects')}
        className="mb-4"
        disabled={saving || deleting}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロジェクト一覧
      </Button>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>プロジェクト設定</CardTitle>
            <CardDescription>プロジェクトの基本情報を編集します</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              {error && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">
                  プロジェクト名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={saving}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack_webhook_url">Slack Webhook URL (任意)</Label>
                <Input
                  id="slack_webhook_url"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formData.slack_webhook_url}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      slack_webhook_url: e.target.value,
                    })
                  }
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  通話処理完了時にSlack通知を送信するWebhook URL
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button type="submit" disabled={saving}>
                  {saving ? '保存中...' : '変更を保存'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>メンバー管理</CardTitle>
                <CardDescription>
                  プロジェクトメンバーを管理します ({memberCount} メンバー, {directorCount}{' '}
                  ディレクター)
                </CardDescription>
              </div>
              <Button onClick={handleManageMembers}>
                <Users className="mr-2 h-4 w-4" />
                メンバーを管理
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">危険な操作</CardTitle>
            <CardDescription>この操作は取り消せません。慎重に実行してください。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              プロジェクトを削除
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。プロジェクト「{project?.name}
              」とそれに関連するすべてのデータが完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
