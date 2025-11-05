'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, Clock, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

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

export default function PromptHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const promptId = params.promptId as string

  const [history, setHistory] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [promptId])

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/prompts/${promptId}/history`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch history')
      }

      setHistory(data.data.history || [])
    } catch (err: any) {
      console.error('Error fetching history:', err)
      setError(err.message || '履歴の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (version: number) => {
    setRestoring(version.toString())

    try {
      const res = await fetch(`/api/prompts/${promptId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version,
          change_comment: `バージョン ${version} から復元`,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'バージョンの復元に失敗しました')
      }

      toast.success(data.data.message || 'バージョンを復元しました')

      // Refresh history
      await fetchHistory()

      // Navigate back to prompts list after a delay
      setTimeout(() => {
        router.push(`/projects/${projectId}/prompts`)
      }, 1500)
    } catch (err: any) {
      console.error('Error restoring version:', err)
      toast.error(err.message || 'バージョンの復元に失敗しました')
    } finally {
      setRestoring(null)
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

  const promptType =
    history.length > 0
      ? history[0].prompt_type === 'connected'
        ? 'つながった通話用'
        : '受付に当たった通話用'
      : ''

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

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Clock className="h-8 w-8" />
          プロンプト変更履歴
        </h1>
        <p className="mt-2 text-gray-600">{promptType}（過去10件）</p>
      </div>

      <div className="space-y-4">
        {history.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                <p>履歴がありません</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          history.map((item, index) => (
            <Card key={item.id} className={item.is_active ? 'border-blue-300 bg-blue-50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Version {item.version}</CardTitle>
                    {item.is_active && (
                      <Badge variant="default" className="bg-blue-600">
                        アクティブ
                      </Badge>
                    )}
                    {index === 0 && !item.is_active && <Badge variant="secondary">最新</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      {new Date(item.created_at).toLocaleString('ja-JP')}
                    </div>
                    {!item.is_active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoring === item.version.toString()}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {restoring === item.version.toString() ? '復元中...' : '復元'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>バージョンを復元しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              バージョン {item.version} を新しいバージョンとして復元します。
                              現在のアクティブバージョンは無効化され、このバージョンの内容が新しいアクティブバージョンになります。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRestore(item.version)}>
                              復元する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                {item.change_comment && (
                  <CardDescription className="mt-2">
                    <strong>変更コメント:</strong> {item.change_comment}
                  </CardDescription>
                )}
                <CardDescription>作成者: {item.created_by_user?.name || 'Unknown'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-white p-4">
                  <pre className="whitespace-pre-wrap text-sm">{item.content}</pre>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
