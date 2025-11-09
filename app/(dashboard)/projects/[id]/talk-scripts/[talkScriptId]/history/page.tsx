'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
} from '@/components/ui/alert-dialog'
import { Clock, User, RotateCcw, Loader2, ChevronRight } from 'lucide-react'

interface HearingItem {
  id: string
  item_name: string
  item_script: string
  is_default: boolean
  display_order: number
}

interface TalkScriptVersion {
  id: string
  version: number
  opening_script: string | null
  proposal_script: string | null
  closing_script: string | null
  hearing_items: HearingItem[]
  change_comment: string
  is_active: boolean
  created_by: {
    id: string
    name: string
  }
  created_at: string
  diff: {
    opening_changed: boolean
    proposal_changed: boolean
    closing_changed: boolean
    hearing_items_changed: boolean
  } | null
}

export default function TalkScriptHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const talkScriptId = params.talkScriptId as string

  const [history, setHistory] = useState<TalkScriptVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<TalkScriptVersion | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [talkScriptId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/talk-scripts/${talkScriptId}/history`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch history')
      }

      setHistory(data.data.history)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreClick = (version: TalkScriptVersion) => {
    setSelectedVersion(version)
    setRestoreDialogOpen(true)
  }

  const handleRestoreConfirm = async () => {
    if (!selectedVersion) return

    try {
      setRestoring(true)
      const response = await fetch(`/api/talk-scripts/${selectedVersion.id}/restore`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to restore version')
      }

      // Redirect to talk scripts page
      router.push(`/projects/${projectId}/talk-scripts`)
    } catch (err: any) {
      setError(err.message)
      setRestoreDialogOpen(false)
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-400" />
          <p className="mt-4 text-gray-600">Loading history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={fetchHistory} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">トークスクリプト履歴</h1>
          <p className="mt-2 text-gray-600">過去10バージョンの変更履歴</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/projects/${projectId}/talk-scripts`)}
        >
          戻る
        </Button>
      </div>

      <div className="space-y-4">
        {history.map((version, index) => (
          <Card key={version.id} className={version.is_active ? 'border-blue-500' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-400">v{version.version}</div>
                  {version.is_active && <Badge variant="default">Current Version</Badge>}
                  {version.diff && (
                    <div className="flex gap-2">
                      {version.diff.opening_changed && (
                        <Badge variant="outline" className="text-xs">
                          Opening
                        </Badge>
                      )}
                      {version.diff.hearing_items_changed && (
                        <Badge variant="outline" className="text-xs">
                          Hearing
                        </Badge>
                      )}
                      {version.diff.proposal_changed && (
                        <Badge variant="outline" className="text-xs">
                          Proposal
                        </Badge>
                      )}
                      {version.diff.closing_changed && (
                        <Badge variant="outline" className="text-xs">
                          Closing
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {!version.is_active && (
                  <Button variant="outline" size="sm" onClick={() => handleRestoreClick(version)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    復元
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="mr-2 h-4 w-4" />
                  <span>{version.created_by.name}</span>
                  <span className="mx-2">•</span>
                  <Clock className="mr-2 h-4 w-4" />
                  <span>
                    {new Date(version.created_at).toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {version.change_comment && (
                  <div className="text-sm">
                    <span className="font-semibold">変更コメント: </span>
                    <span className="text-gray-700">{version.change_comment}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-4">
                  <div className="text-sm">
                    <div className="text-gray-600">オープニング</div>
                    <div className="font-medium">
                      {version.opening_script ? `${version.opening_script.length} 文字` : '未設定'}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-600">ヒアリング項目</div>
                    <div className="font-medium">{version.hearing_items.length} 項目</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-600">提案</div>
                    <div className="font-medium">
                      {version.proposal_script
                        ? `${version.proposal_script.length} 文字`
                        : '未設定'}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-600">クロージング</div>
                    <div className="font-medium">
                      {version.closing_script ? `${version.closing_script.length} 文字` : '未設定'}
                    </div>
                  </div>
                </div>

                {index < history.length - 1 && (
                  <div className="border-t pt-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <ChevronRight className="mr-1 h-4 w-4" />
                      <span>v{history[index + 1].version} からの変更</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>バージョンを復元しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVersion && (
                <>
                  バージョン {selectedVersion.version}{' '}
                  を復元すると、新しいバージョンとして保存されます。
                  現在のバージョンは履歴に残ります。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm} disabled={restoring}>
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  復元中...
                </>
              ) : (
                '復元'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
