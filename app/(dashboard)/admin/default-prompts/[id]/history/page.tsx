'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface PromptVersion {
  id: string
  prompt_id: string
  content: string
  version: number
  change_comment: string | null
  created_by: string
  created_at: string
  users: {
    id: string
    name: string
    email: string
  }
}

interface PromptHistory {
  current_prompt_id: string
  prompt_type: string
  versions: PromptVersion[]
  total: number
}

export default function DefaultPromptHistoryPage() {
  const router = useRouter()
  const params = useParams()
  const promptId = params.id as string

  const [history, setHistory] = useState<PromptHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [versionToRestore, setVersionToRestore] = useState<PromptVersion | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (promptId) {
      fetchHistory()
    }
  }, [promptId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/default-prompts/${promptId}/history`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || '履歴の取得に失敗しました')
      }

      setHistory(result.data)
    } catch (err: any) {
      console.error('Error fetching history:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreClick = (version: PromptVersion) => {
    setVersionToRestore(version)
    setShowRestoreDialog(true)
  }

  const handleRestore = async () => {
    if (!versionToRestore) return

    setRestoring(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/default-prompts/${promptId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version_id: versionToRestore.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || '復元に失敗しました')
      }

      setShowRestoreDialog(false)
      router.push('/admin/default-prompts')
    } catch (err: any) {
      console.error('Error restoring version:', err)
      setError(err.message)
      setShowRestoreDialog(false)
    } finally {
      setRestoring(false)
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

  if (!history) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || '履歴が見つかりません'}</p>
            <Button onClick={() => router.push('/admin/default-prompts')} className="mt-4">
              デフォルトプロンプト管理に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const promptTypeLabel =
    history.prompt_type === 'connected' ? 'Connected通話用' : 'Reception通話用'

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
        <h1 className="text-3xl font-bold">デフォルトプロンプト履歴</h1>
        <p className="mt-2 text-muted-foreground">{promptTypeLabel}</p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {history.versions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">履歴がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {history.versions.map((version, index) => (
            <Card key={version.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>
                      バージョン {version.version}
                      {index === 0 && (
                        <span className="ml-2 text-sm font-normal text-green-600">(現在)</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {new Date(version.created_at).toLocaleString('ja-JP')} by {version.users.name}
                    </CardDescription>
                    {version.change_comment && (
                      <p className="mt-2 text-sm">{version.change_comment}</p>
                    )}
                  </div>
                  {index !== 0 && (
                    <Button variant="outline" size="sm" onClick={() => handleRestoreClick(version)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      復元
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{version.content}</ReactMarkdown>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  文字数: {version.content.length} 文字
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>バージョンを復元しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {versionToRestore && (
                <>
                  バージョン {versionToRestore.version} (
                  {new Date(versionToRestore.created_at).toLocaleString('ja-JP')}) を復元します。
                  <br />
                  <br />
                  復元すると、新しいバージョンとして保存されます。現在のバージョンは履歴に残ります。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? '復元中...' : '復元する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
