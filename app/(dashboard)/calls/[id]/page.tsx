'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Phone, Clock, User, Calendar, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface CallDetail {
  id: string
  zoom_call_id: string
  call_time: string
  duration_seconds: number
  direction: string
  caller_number: string
  callee_number: string
  status: 'connected' | 'reception' | 'no_conversation'
  status_confidence: number
  feedback_text: string | null
  audio_signed_url: string | null
  transcript_signed_url: string | null
  transcript_text: string | null
  user: {
    id: string
    name: string
    email: string
  } | null
  project: {
    id: string
    name: string
  } | null
  prompt: {
    id: string
    version: number
    prompt_type: string
    created_at: string
  } | null
  created_at: string
}

export default function CallDetailPage() {
  const params = useParams()
  const router = useRouter()
  const callId = params.id as string

  const [call, setCall] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCallDetail()
  }, [callId])

  const fetchCallDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/calls/${callId}`)
      const result = await response.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      setCall(result.data)
    } catch (err: any) {
      console.error('Error fetching call detail:', err)
      setError('通話情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">つながった（有意義な会話）</Badge>
      case 'reception':
        return <Badge className="bg-yellow-500">受付に当たっただけ</Badge>
      case 'no_conversation':
        return <Badge className="bg-red-500">会話なし</Badge>
      default:
        return <Badge>不明</Badge>
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}分${remainingSeconds}秒`
  }

  const formatDate = (dateString: string) => {
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
    return `${year}/${month}/${day} ${hour}:${minute}`
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">読み込み中...</div>
      </div>
    )
  }

  if (error || !call) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error || '通話が見つかりません'}</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
      </div>

      {/* Basic Information */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>通話詳細</CardTitle>
              <CardDescription>Call ID: {call.id}</CardDescription>
            </div>
            {getStatusBadge(call.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">通話日時</div>
                <div className="font-medium">{formatDate(call.call_time)}</div>
              </div>
            </div>

            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">通話時間</div>
                <div className="font-medium">{formatDuration(call.duration_seconds)}</div>
              </div>
            </div>

            <div className="flex items-center">
              <Phone className="mr-2 h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">発信者番号</div>
                <div className="font-medium">{call.caller_number || 'N/A'}</div>
              </div>
            </div>

            <div className="flex items-center">
              <Phone className="mr-2 h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">着信番号</div>
                <div className="font-medium">{call.callee_number || 'N/A'}</div>
              </div>
            </div>

            {call.user && (
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">ユーザー</div>
                  <div className="font-medium">{call.user.name}</div>
                </div>
              </div>
            )}

            {call.project && (
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">プロジェクト</div>
                  <div className="font-medium">{call.project.name}</div>
                </div>
              </div>
            )}
          </div>

          {/* AI Detection Confidence */}
          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <div className="mb-1 text-sm text-gray-500">AI判定信頼度</div>
            <div className="font-medium">{(call.status_confidence * 100).toFixed(0)}%</div>
          </div>
        </CardContent>
      </Card>

      {/* Audio Player */}
      {call.audio_signed_url && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>音声ファイル</CardTitle>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full">
              <source src={call.audio_signed_url} type="audio/mpeg" />
              お使いのブラウザは音声再生に対応していません。
            </audio>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <a href={call.audio_signed_url} download>
                <Download className="mr-2 h-4 w-4" />
                ダウンロード
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feedback and Transcript Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>フィードバック・文字起こし</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={call.feedback_text ? 'feedback' : 'transcript'}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="feedback" disabled={!call.feedback_text}>
                AIフィードバック
              </TabsTrigger>
              <TabsTrigger value="transcript">文字起こし</TabsTrigger>
            </TabsList>

            {/* Feedback Tab */}
            <TabsContent value="feedback">
              {call.feedback_text ? (
                <div className="prose max-w-none">
                  <ReactMarkdown>{call.feedback_text}</ReactMarkdown>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p className="mb-2 font-medium">AIフィードバックがありません</p>
                  <div className="space-y-2 text-sm">
                    <p>フィードバックが生成されない理由：</p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>通話ステータスが「つながった」ではない</li>
                      <li>通話時間が60秒未満</li>
                      <li>この通話はフィードバック機能実装前に記録されたもの</li>
                    </ul>
                    <p className="mt-4 text-xs text-gray-400">
                      現在のステータス: <strong>{call.status}</strong> / 通話時間:{' '}
                      <strong>{call.duration_seconds}秒</strong>
                    </p>
                  </div>
                </div>
              )}

              {call.prompt && (
                <div className="mt-4 text-sm text-gray-500">
                  使用プロンプト: バージョン {call.prompt.version} ({call.prompt.prompt_type})
                </div>
              )}
            </TabsContent>

            {/* Transcript Tab */}
            <TabsContent value="transcript">
              {call.transcript_text ? (
                <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-4">
                  {call.transcript_text}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">文字起こしが利用できません</div>
              )}

              {call.transcript_signed_url && (
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <a href={call.transcript_signed_url} download>
                    <Download className="mr-2 h-4 w-4" />
                    文字起こしダウンロード
                  </a>
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
