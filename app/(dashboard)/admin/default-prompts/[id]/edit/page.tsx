'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Prompt {
  id: string
  prompt_type: string
  content: string
  version: number
  is_active: boolean
  change_comment: string | null
  created_at: string
}

export default function EditDefaultPromptPage() {
  const router = useRouter()
  const params = useParams()
  const promptId = params.id as string

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [content, setContent] = useState('')
  const [changeComment, setChangeComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (promptId) {
      fetchPrompt()
    }
  }, [promptId])

  const fetchPrompt = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/default-prompts/${promptId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの取得に失敗しました')
      }

      setPrompt(result.data)
      setContent(result.data.content)
    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) {
      setError('プロンプト内容を入力してください')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/default-prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          change_comment: changeComment || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの更新に失敗しました')
      }

      router.push('/admin/default-prompts')
    } catch (err: any) {
      console.error('Error updating prompt:', err)
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

  if (!prompt) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'プロンプトが見つかりません'}</p>
            <Button onClick={() => router.push('/admin/default-prompts')} className="mt-4">
              デフォルトプロンプト管理に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const promptTypeLabel = prompt.prompt_type === 'connected' ? 'Connected通話用' : 'Reception通話用'

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/admin/default-prompts')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        デフォルトプロンプト管理に戻る
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">デフォルトプロンプトを編集</h1>
        <p className="mt-2 text-muted-foreground">{promptTypeLabel}</p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>プロンプト内容</CardTitle>
          <CardDescription>Markdown形式で記述できます</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="content">
              プロンプト内容 <span className="text-destructive">*</span>
            </Label>
            <div data-color-mode="light">
              <MDEditor
                value={content}
                onChange={value => setContent(value || '')}
                preview="edit"
                height={500}
              />
            </div>
            <p className="text-sm text-muted-foreground">文字数: {content.length} 文字</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="change_comment">変更コメント</Label>
            <Input
              id="change_comment"
              type="text"
              placeholder="どのような変更を行ったか（任意）"
              value={changeComment}
              onChange={e => setChangeComment(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">例: 具体的な数値目標を追加</p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/default-prompts')}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving || !content.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>現在のバージョン情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">バージョン</dt>
              <dd className="mt-1">v{prompt.version}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">最終更新日</dt>
              <dd className="mt-1">{new Date(prompt.created_at).toLocaleString('ja-JP')}</dd>
            </div>
            {prompt.change_comment && (
              <div className="col-span-2">
                <dt className="font-medium text-muted-foreground">前回の変更コメント</dt>
                <dd className="mt-1">{prompt.change_comment}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
