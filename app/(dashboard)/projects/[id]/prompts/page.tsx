'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, History, Edit, Trash2, FileText } from 'lucide-react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

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
  created_by_user?: {
    id: string
    name: string
    email: string
  }
}

export default function PromptsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [connectedPrompts, setConnectedPrompts] = useState<Prompt[]>([])
  const [receptionPrompts, setReceptionPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPrompts()
  }, [projectId])

  const fetchPrompts = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch connected prompts
      const connectedRes = await fetch(`/api/prompts?project_id=${projectId}&prompt_type=connected`)
      const connectedData = await connectedRes.json()

      if (!connectedData.success) {
        throw new Error(connectedData.error?.message || 'Failed to fetch connected prompts')
      }

      // Fetch reception prompts
      const receptionRes = await fetch(`/api/prompts?project_id=${projectId}&prompt_type=reception`)
      const receptionData = await receptionRes.json()

      if (!receptionData.success) {
        throw new Error(receptionData.error?.message || 'Failed to fetch reception prompts')
      }

      setConnectedPrompts(connectedData.data.items || [])
      setReceptionPrompts(receptionData.data.items || [])
    } catch (err: any) {
      console.error('Error fetching prompts:', err)
      setError(err.message || 'プロンプトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (promptId: string) => {
    try {
      const res = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete prompt')
      }

      // Refresh prompts
      await fetchPrompts()
    } catch (err: any) {
      console.error('Error deleting prompt:', err)
      alert(err.message || 'プロンプトの削除に失敗しました')
    }
  }

  const renderPromptCard = (prompt: Prompt) => (
    <Card key={prompt.id} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Version {prompt.version}</CardTitle>
            {prompt.is_active && <Badge variant="default">アクティブ</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/prompts/${prompt.id}/history`}>
                <History className="mr-2 h-4 w-4" />
                履歴
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/prompts/${prompt.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>プロンプトを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。Version {prompt.version}{' '}
                    のプロンプトが完全に削除されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(prompt.id)}>
                    削除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {prompt.change_comment && <CardDescription>{prompt.change_comment}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-sm text-gray-600">
          作成者: {prompt.created_by_user?.name || 'Unknown'} | 作成日時:{' '}
          {new Date(prompt.created_at).toLocaleString('ja-JP')}
        </div>
        <div className="rounded-md bg-gray-50 p-4">
          <pre className="whitespace-pre-wrap text-sm">{prompt.content}</pre>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
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

  const activeConnected = connectedPrompts.find(p => p.is_active)
  const activeReception = receptionPrompts.find(p => p.is_active)

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">プロンプト管理</h1>
          <p className="mt-2 text-gray-600">AIフィードバック生成に使用するプロンプトを管理します</p>
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/prompts/new`}>
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="connected" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connected">
            <FileText className="mr-2 h-4 w-4" />
            つながった通話用
            {activeConnected && (
              <Badge variant="secondary" className="ml-2">
                v{activeConnected.version}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reception">
            <FileText className="mr-2 h-4 w-4" />
            受付に当たった通話用
            {activeReception && (
              <Badge variant="secondary" className="ml-2">
                v{activeReception.version}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="mt-6">
          {connectedPrompts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p>つながった通話用のプロンプトがまだありません</p>
                  <Button className="mt-4" asChild>
                    <Link href={`/projects/${projectId}/prompts/new?type=connected`}>
                      <Plus className="mr-2 h-4 w-4" />
                      最初のプロンプトを作成
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>{connectedPrompts.map(renderPromptCard)}</div>
          )}
        </TabsContent>

        <TabsContent value="reception" className="mt-6">
          {receptionPrompts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p>受付に当たった通話用のプロンプトがまだありません</p>
                  <Button className="mt-4" asChild>
                    <Link href={`/projects/${projectId}/prompts/new?type=reception`}>
                      <Plus className="mr-2 h-4 w-4" />
                      最初のプロンプトを作成
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>{receptionPrompts.map(renderPromptCard)}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
