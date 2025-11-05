'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, TestTube } from 'lucide-react'

interface Project {
  id: string
  name: string
}

export default function NewPromptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('project_id') || ''

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(initialProjectId)
  const [type, setType] = useState<'status_detection' | 'basic_feedback' | 'advanced_feedback'>(
    'status_detection'
  )
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()

      if (response.ok) {
        setProjects(result.data.items)
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err)
    }
  }

  const handleTestPrompt = async () => {
    if (!content || !testInput) {
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
          project_id: projectId,
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

    if (!projectId) {
      setError('プロジェクトを選択してください')
      return
    }

    if (!content) {
      setError('プロンプト内容を入力してください')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          type,
          content,
          is_active: isActive,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの作成に失敗しました')
      }

      router.push(`/prompts?project_id=${projectId}`)
    } catch (err: any) {
      console.error('Error creating prompt:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        onClick={() => router.push(`/prompts?project_id=${projectId}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロンプト一覧に戻る
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>新規プロンプト作成</CardTitle>
          <CardDescription>AIフィードバック用のプロンプトを作成します</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project">
                プロジェクト <span className="text-destructive">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                プロンプトタイプ <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status_detection">ステータス検出（GPT-4o-mini用）</SelectItem>
                  <SelectItem value="basic_feedback">
                    基本フィードバック（GPT-4o-mini用）
                  </SelectItem>
                  <SelectItem value="advanced_feedback">詳細フィードバック（GPT-5用）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                ステータス検出: 通話ステータス判定用 / 基本: RAG無しフィードバック / 詳細:
                RAG有りフィードバック
              </p>
            </div>

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
              <p className="text-sm text-muted-foreground">GPTに渡されるシステムプロンプトです</p>
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
                onClick={() => router.push(`/prompts?project_id=${projectId}`)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={saving || !projectId}>
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
