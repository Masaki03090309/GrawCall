'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Prompt {
  id: string
  project_id: string
  prompt_type: 'connected' | 'reception'
  content: string
  version: number
  created_by: string
  change_comment: string | null
  is_active: boolean
  created_at: string
}

export default function EditPromptPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const promptId = params.promptId as string

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const characterCount = content.length

  useEffect(() => {
    fetchPrompt()
  }, [promptId])

  const fetchPrompt = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/prompts/${promptId}`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch prompt')
      }

      const promptData = data.data
      setPrompt(promptData)
      setContent(promptData.content)
      setIsActive(promptData.is_active)
    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message || 'プロンプトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          is_active: isActive,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update prompt')
      }

      // Redirect to prompts list
      router.push(`/projects/${projectId}/prompts`)
    } catch (err: any) {
      console.error('Error updating prompt:', err)
      setError(err.message || 'プロンプトの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !prompt) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">エラー</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>プロンプトが見つかりません</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}/prompts`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロンプト一覧に戻る
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>プロンプトを編集</CardTitle>
          <CardDescription>
            Version {prompt.version} ・{' '}
            {prompt.prompt_type === 'connected' ? 'つながった通話用' : '受付に当たった通話用'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">プロンプト内容 *</Label>
                <span className="text-sm text-gray-500">
                  {characterCount.toLocaleString()} 文字
                </span>
              </div>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={val => setContent(val || '')}
                  height={400}
                  preview="edit"
                  textareaProps={{
                    placeholder: 'プロンプト内容を入力してください...',
                  }}
                />
              </div>
              <p className="text-sm text-gray-500">
                AIにフィードバック生成を指示するプロンプトを記述します（マークダウン記法対応）
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is-active" className="cursor-pointer">
                このプロンプトをアクティブにする
              </Label>
            </div>
            <p className="ml-6 text-sm text-gray-500">
              アクティブなプロンプトが実際のAIフィードバック生成に使用されます。
              同じタイプの既存のアクティブプロンプトは自動的に非アクティブになります。
            </p>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving || !content.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '変更を保存'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/projects/${projectId}/prompts`}>キャンセル</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
