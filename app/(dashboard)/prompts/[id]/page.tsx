'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Edit, Trash2, CheckCircle, Circle } from 'lucide-react'

interface Prompt {
  id: string
  project_id: string
  type: 'status_detection' | 'basic_feedback' | 'advanced_feedback'
  version: number
  content: string
  is_active: boolean
  created_at: string
  created_by: string
}

export default function PromptDetailPage() {
  const router = useRouter()
  const params = useParams()
  const promptId = params.id as string

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPrompt()
  }, [promptId])

  const fetchPrompt = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/prompts/${promptId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの取得に失敗しました')
      }

      setPrompt(result.data)
    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このプロンプトを削除しますか？')) {
      return
    }

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの削除に失敗しました')
      }

      router.push(`/prompts?project_id=${prompt?.project_id}`)
    } catch (err: any) {
      console.error('Error deleting prompt:', err)
      setError(err.message)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'status_detection':
        return 'ステータス検出'
      case 'basic_feedback':
        return '基本フィードバック'
      case 'advanced_feedback':
        return '詳細フィードバック'
      default:
        return type
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

  if (error || !prompt) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <p className="text-destructive">{error || 'プロンプトが見つかりません'}</p>
          <Button onClick={() => router.push('/prompts')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロンプト一覧に戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        onClick={() => router.push(`/prompts?project_id=${prompt.project_id}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロンプト一覧に戻る
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>プロンプト詳細</CardTitle>
              <CardDescription>
                {getTypeLabel(prompt.type)} - バージョン {prompt.version}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(`/prompts/${promptId}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                削除
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">ステータス</h3>
            <div className="flex items-center gap-2">
              {prompt.is_active ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span className="font-medium">{prompt.is_active ? '有効' : '無効'}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">作成日時</h3>
            <p>{new Date(prompt.created_at).toLocaleString('ja-JP')}</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">プロンプト内容</h3>
            <div className="rounded-md bg-muted p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">{prompt.content}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
