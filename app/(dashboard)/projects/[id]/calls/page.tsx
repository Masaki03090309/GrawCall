'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Phone, Clock, Eye, ArrowLeft } from 'lucide-react'

interface Call {
  id: string
  call_time: string
  duration_seconds: number
  caller_number: string
  callee_number: string
  status: 'connected' | 'reception' | 'no_conversation'
  feedback_text: string | null
  user: {
    id: string
    name: string
    email: string
  } | null
}

interface Project {
  id: string
  name: string
}

export default function ProjectCallsPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchProject()
    fetchCalls()
  }, [projectId, statusFilter])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const result = await response.json()

      if (result.success && result.data) {
        setProject(result.data)
      }
    } catch (err: any) {
      console.error('Error fetching project:', err)
    }
  }

  const fetchCalls = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        project_id: projectId,
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/calls?${params.toString()}`)
      const result = await response.json()

      if (!result.success) {
        setError(result.error?.message || '通話一覧の取得に失敗しました')
        return
      }

      setCalls(result.data.items || [])
    } catch (err: any) {
      console.error('Error fetching calls:', err)
      setError('通話一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-600">つながった</Badge>
      case 'reception':
        return <Badge className="bg-yellow-600">受付</Badge>
      case 'no_conversation':
        return <Badge variant="secondary">会話なし</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
    return `${year}/${month}/${day} ${hour}:${minute}`
  }

  if (loading && !project) {
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
      <Button
        variant="ghost"
        onClick={() => router.push(`/projects/${projectId}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        プロジェクト設定に戻る
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {project?.name || 'プロジェクト'} - 通話履歴
              </CardTitle>
              <CardDescription>このプロジェクトのメンバーの通話履歴を確認できます</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ステータスで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="connected">つながった</SelectItem>
                  <SelectItem value="reception">受付</SelectItem>
                  <SelectItem value="no_conversation">会話なし</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">読み込み中...</div>
          ) : calls.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">通話履歴がありません</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>通話日時</TableHead>
                    <TableHead>発信者</TableHead>
                    <TableHead>受信者番号</TableHead>
                    <TableHead>ユーザー</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>通話時間</TableHead>
                    <TableHead>フィードバック</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map(call => (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">
                        {formatDateTime(call.call_time)}
                      </TableCell>
                      <TableCell>{call.caller_number}</TableCell>
                      <TableCell>{call.callee_number}</TableCell>
                      <TableCell>
                        {call.user ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{call.user.name}</span>
                            <span className="text-xs text-muted-foreground">{call.user.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">不明</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.feedback_text ? (
                          <Badge variant="outline" className="bg-blue-50">
                            あり
                          </Badge>
                        ) : (
                          <Badge variant="secondary">なし</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/calls/${call.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          詳細
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {calls.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">{calls.length} 件の通話履歴</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
