'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, TestTube, Eye, Clock } from 'lucide-react'

interface Prompt {
  id: string
  project_id: string | null
  prompt_type: 'connected' | 'reception'
  version: number
  content: string
  is_active: boolean
  created_at: string
  created_by: string
}

interface Call {
  id: string
  call_time: string
  caller_number: string
  callee_number: string
  duration_seconds: number
  transcript: string | null
  user?: {
    name: string
    email: string
  }
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
  const [calls, setCalls] = useState<Call[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string>('')
  const [loadingCalls, setLoadingCalls] = useState(false)
  const [viewingCall, setViewingCall] = useState<Call | null>(null)
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)

  useEffect(() => {
    fetchPrompt()
  }, [promptId])

  useEffect(() => {
    if (prompt?.project_id) {
      fetchCalls(prompt.project_id)
    }
  }, [prompt?.project_id])

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

  const fetchCalls = async (projectId: string) => {
    try {
      setLoadingCalls(true)
      const response = await fetch(`/api/calls?project_id=${projectId}&status=connected&limit=20`)
      const result = await response.json()

      if (response.ok && result.success) {
        setCalls(result.data.items || [])
      }
    } catch (err: any) {
      console.error('Error fetching calls:', err)
    } finally {
      setLoadingCalls(false)
    }
  }

  const handleViewCall = async (call: Call) => {
    try {
      // Fetch full call details including transcript
      const response = await fetch(`/api/calls/${call.id}`)
      const result = await response.json()

      if (response.ok && result.success) {
        // Set viewing call with transcript_text
        setViewingCall({
          ...call,
          transcript: result.data.transcript_text || null,
        })
        setIsCallDialogOpen(true)
      } else {
        setError('文字起こしの取得に失敗しました')
      }
    } catch (err: any) {
      console.error('Error fetching call details:', err)
      setError('文字起こしの取得に失敗しました')
    }
  }

  const handleUseCall = () => {
    if (viewingCall?.transcript) {
      setTestInput(viewingCall.transcript)
      setSelectedCallId(viewingCall.id)
      setIsCallDialogOpen(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDateTime = (dateString: string) => {
    // Database returns UTC time without 'Z', so we need to add it
    const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z'
    const date = new Date(utcString)

    // Convert UTC to JST (UTC+9) by adding 9 hours in milliseconds
    const jstOffset = 9 * 60 * 60 * 1000
    const jstTime = new Date(date.getTime() + jstOffset)

    const year = jstTime.getUTCFullYear()
    const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(jstTime.getUTCDate()).padStart(2, '0')
    const hour = String(jstTime.getUTCHours()).padStart(2, '0')
    const minute = String(jstTime.getUTCMinutes()).padStart(2, '0')
    const second = String(jstTime.getUTCSeconds()).padStart(2, '0')
    return `${year}/${month}/${day} ${hour}:${minute}:${second}`
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
      case 'connected':
        return 'Connected用プロンプト'
      case 'reception':
        return 'Reception用プロンプト'
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
            {getTypeLabel(prompt.prompt_type)} - バージョン {prompt.version}
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
              <h3 className="text-lg font-semibold">プロンプトテスト（GPT-5-nano）</h3>

              {/* 通話選択 */}
              <div className="space-y-2">
                <Label>過去の通話から選択（Connected通話のみ、最新20件）</Label>
                {loadingCalls ? (
                  <p className="py-4 text-center text-muted-foreground">読み込み中...</p>
                ) : calls.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">Connected通話がありません</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>通話日時</TableHead>
                          <TableHead>ユーザー</TableHead>
                          <TableHead>通話時間</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calls.map(call => (
                          <TableRow key={call.id} className={selectedCallId === call.id ? 'bg-blue-50' : ''}>
                            <TableCell className="font-medium">
                              {formatDateTime(call.call_time)}
                            </TableCell>
                            <TableCell>
                              {call.user ? (
                                <div className="flex flex-col">
                                  <span className="font-medium">{call.user.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {call.user.email}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">不明</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {formatDuration(call.duration_seconds)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewCall(call)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                会話を見る
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="test_input">テスト入力</Label>
                <textarea
                  id="test_input"
                  className="min-h-[100px] w-full rounded-md border p-3 font-mono text-sm"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  placeholder="テスト用の文字起こしを入力するか、上の通話から選択してください..."
                  disabled={testing}
                />
                {selectedCallId && (
                  <p className="text-xs text-muted-foreground">
                    ✓ 選択中の通話ID: {selectedCallId}
                  </p>
                )}
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

      {/* 会話内容表示Dialog */}
      <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>会話内容</DialogTitle>
            <DialogDescription>
              {viewingCall && (
                <>
                  {formatDateTime(viewingCall.call_time)} - {viewingCall.user?.name || '不明'} ({formatDuration(viewingCall.duration_seconds)})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {viewingCall?.transcript || '文字起こしがありません'}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUseCall}>
              この通話を使う
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
