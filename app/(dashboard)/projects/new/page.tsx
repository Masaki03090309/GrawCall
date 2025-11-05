'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function NewProjectPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    slack_webhook_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
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
        throw new Error(result.error?.message || 'プロジェクトの作成に失敗しました')
      }

      // Redirect to the new project page
      router.push(`/projects/${result.data.id}`)
    } catch (err: any) {
      console.error('Error creating project:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Button variant="ghost" onClick={handleCancel} className="mb-4" disabled={loading}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        戻る
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>新規プロジェクト作成</CardTitle>
          <CardDescription>新しいプロジェクトを作成して、メンバーを管理します</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
                placeholder="例: 営業部門A"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
                maxLength={255}
              />
              <p className="text-sm text-muted-foreground">
                プロジェクトを識別するための名前を入力してください
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slack_webhook_url">Slack Webhook URL (任意)</Label>
              <Input
                id="slack_webhook_url"
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={formData.slack_webhook_url}
                onChange={e => setFormData({ ...formData, slack_webhook_url: e.target.value })}
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                通話処理完了時にSlack通知を送信するWebhook URLを入力してください
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                キャンセル
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '作成中...' : 'プロジェクトを作成'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
