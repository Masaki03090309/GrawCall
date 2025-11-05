'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Eye, Edit, Trash2, CheckCircle, Circle } from 'lucide-react'

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

interface Project {
  id: string
  name: string
}

export default function PromptsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('project_id') || ''

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      fetchPrompts()
    } else {
      setPrompts([])
      setLoading(false)
    }
  }, [selectedProjectId, selectedType])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()

      if (response.ok) {
        setProjects(result.data.items)
        if (result.data.items.length > 0 && !selectedProjectId) {
          setSelectedProjectId(result.data.items[0].id)
        }
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        project_id: selectedProjectId,
      })

      if (selectedType !== 'all') {
        params.append('type', selectedType)
      }

      const response = await fetch(`/api/prompts?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの取得に失敗しました')
      }

      setPrompts(result.data.items)
    } catch (err: any) {
      console.error('Error fetching prompts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePrompt = async (promptId: string) => {
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

      await fetchPrompts()
    } catch (err: any) {
      console.error('Error deleting prompt:', err)
      setError(err.message)
    }
  }

  const handleToggleActive = async (promptId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentActive,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'プロンプトの更新に失敗しました')
      }

      await fetchPrompts()
    } catch (err: any) {
      console.error('Error toggling prompt:', err)
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

  if (loading && prompts.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>プロンプト管理</CardTitle>
              <CardDescription>
                通話分析AIのプロンプトを管理します（バージョン管理対応）
              </CardDescription>
            </div>
            <Button
              onClick={() => router.push(`/prompts/new?project_id=${selectedProjectId}`)}
              disabled={!selectedProjectId}
            >
              <Plus className="mr-2 h-4 w-4" />
              新規プロンプト
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">プロジェクト</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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

            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">プロンプトタイプ</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="status_detection">ステータス検出</SelectItem>
                  <SelectItem value="basic_feedback">基本フィードバック</SelectItem>
                  <SelectItem value="advanced_feedback">詳細フィードバック</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!selectedProjectId ? (
            <div className="py-8 text-center text-muted-foreground">
              プロジェクトを選択してください
            </div>
          ) : prompts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">プロンプトがありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイプ</TableHead>
                  <TableHead>バージョン</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>内容プレビュー</TableHead>
                  <TableHead>作成日時</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prompts.map(prompt => (
                  <TableRow key={prompt.id}>
                    <TableCell className="font-medium">{getTypeLabel(prompt.type)}</TableCell>
                    <TableCell>v{prompt.version}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(prompt.id, prompt.is_active)}
                      >
                        {prompt.is_active ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="ml-2">{prompt.is_active ? '有効' : '無効'}</span>
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {prompt.content.substring(0, 100)}...
                    </TableCell>
                    <TableCell>{new Date(prompt.created_at).toLocaleString('ja-JP')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/prompts/${prompt.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/prompts/${prompt.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(prompt.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
