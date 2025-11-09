'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save } from 'lucide-react'

interface Project {
  id: string
  name: string
  slack_webhook_url: string | null
  created_at: string
  updated_at: string
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [projectName, setProjectName] = useState('')
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')

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
      setProjectName(result.data.name)
      setSlackWebhookUrl(result.data.slack_webhook_url || '')
    } catch (err: any) {
      console.error('Error fetching project:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          slack_webhook_url: slackWebhookUrl || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロジェクトの更新に失敗しました')
      }

      setProject(result.data)
      setSuccess('プロジェクト設定を保存しました')
    } catch (err: any) {
      console.error('Error updating project:', err)
      setError(err.message)
    } finally {
      setSaving(false)
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

  if (error && !project) {
    return (
      <div className="container mx-auto py-8">
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

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        onClick={() => router.push(`/projects/${projectId}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロジェクト詳細に戻る
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">プロジェクト設定</h1>
        <p className="mt-2 text-muted-foreground">プロジェクト名やSlack連携の設定を変更できます</p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>基本設定</CardTitle>
            <CardDescription>プロジェクトの基本情報を編集します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                プロジェクト名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="例: 新規事業開拓プロジェクト"
                required
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">プロジェクトを識別するための名前です</p>
            </div>

            {/* Slack Webhook URL */}
            <div className="space-y-2">
              <Label htmlFor="slack_webhook_url">Slack Webhook URL（任意）</Label>
              <Input
                id="slack_webhook_url"
                type="url"
                value={slackWebhookUrl}
                onChange={e => setSlackWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                通話処理完了時にSlack通知を送信します。設定しない場合は通知されません。
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}`)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={saving || !projectName}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '保存する'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Project Info */}
      {project && (
        <Card className="mt-6">
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
                <span className="text-muted-foreground">作成日:</span>
                <span>{new Date(project.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最終更新:</span>
                <span>{new Date(project.updated_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
