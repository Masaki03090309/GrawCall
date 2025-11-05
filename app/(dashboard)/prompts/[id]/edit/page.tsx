'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, TestTube } from 'lucide-react'

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

export default function EditPromptPage() {
  const router = useRouter()
  const params = useParams()
  const promptId = params.id as string

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
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
      setContent(result.data.content)
      setIsActive(result.data.is_active)
    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestPrompt = async () => {
    if (!content || !testInput || !prompt) {
      setError('プロンプト内容とテスト入力の両方が必要です')
      return
    }

    setTesting(true)
    setError(null)
    setTestOutput('')

    try {
      const response = await fetch('/api/prompts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: prompt.project_id,
          prompt_content: content,
          test_input: testInput,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'テストに失敗しました')
      }

      setTestOutput(result.data.response)
    } catch (err: any) {
      console.error('Error testing prompt:', err)
      setError(err.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content) {
      setError('プロンプト内容を入力してください')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          is_active: isActive,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの更新に失敗しました')
      }

      router.push(`/prompts/${promptId}`)
    } catch (err: any) {
      console.error('Error updating prompt:', err)
      setError(err.message)
    } finally {
      setSaving(false)
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
      <Button variant="ghost" onClick={() => router.push(`/prompts/${promptId}`)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロンプト詳細に戻る
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>プロンプト編集</CardTitle>
          <CardDescription>
            {getTypeLabel(prompt.type)} - バージョン {prompt.version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="content">
                プロンプト内容 <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="content"
                className="min-h-[300px] w-full rounded-md border p-3 font-mono text-sm"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="システムプロンプトを入力してください..."
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                プロンプト内容を編集できます。バージョンは変わりません。
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                disabled={saving}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">
                このプロンプトを有効化する（既存の有効プロンプトは自動的に無効化されます）
              </Label>
            </div>

            {/* Test Section */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">プロンプトテスト（GPT-4o-mini）</h3>
              <div className="space-y-2">
                <Label htmlFor="test_input">テスト入力</Label>
                <textarea
                  id="test_input"
                  className="min-h-[100px] w-full rounded-md border p-3"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  placeholder="テスト用のユーザー入力を入力してください..."
                  disabled={testing}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestPrompt}
                disabled={testing || !content || !testInput}
              >
                <TestTube className="mr-2 h-4 w-4" />
                {testing ? 'テスト中...' : 'プロンプトをテスト'}
              </Button>

              {testOutput && (
                <div className="space-y-2">
                  <Label>テスト結果</Label>
                  <div className="whitespace-pre-wrap rounded-md bg-muted p-4">{testOutput}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/prompts/${promptId}`)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
