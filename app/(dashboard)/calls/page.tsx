'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Phone, Clock, Eye, Filter } from 'lucide-react'

interface Call {
  id: string
  call_time: string
  duration_seconds: number
  caller_number: string
  callee_number: string
  status: 'connected' | 'reception' | 'no_conversation'
  feedback_text: string | null
  user: {
    name: string
  } | null
  project: {
    id: string
    name: string
  } | null
}

interface Project {
  id: string
  name: string
}

export default function CallsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [calls, setCalls] = useState<Call[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get('project_id') || 'all'
  )

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    fetchCalls()
  }, [selectedProjectId])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()

      if (result.success && result.data?.items) {
        setProjects(result.data.items)
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchCalls = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (selectedProjectId && selectedProjectId !== 'all') {
        params.append('project_id', selectedProjectId)
      }

      const response = await fetch(`/api/calls?${params.toString()}`)
      const result = await response.json()

      if (!result.success) {
        setError(result.error.message)
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

  const handleProjectFilterChange = (value: string) => {
    setSelectedProjectId(value)

    // Update URL
    if (value === 'all') {
      router.push('/calls')
    } else {
      router.push(`/calls?project_id=${value}`)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">つながった</Badge>
      case 'reception':
        return <Badge className="bg-yellow-500">受付</Badge>
      case 'no_conversation':
        return <Badge className="bg-red-500">会話なし</Badge>
      default:
        return <Badge>不明</Badge>
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    // Database returns UTC time without 'Z', so we need to add it
    const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z'
    const date = new Date(utcString)

    // Convert UTC to JST (UTC+9) by adding 9 hours in milliseconds
    const jstOffset = 9 * 60 * 60 * 1000
    const jstTime = new Date(date.getTime() + jstOffset)

    const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(jstTime.getUTCDate()).padStart(2, '0')
    const hour = String(jstTime.getUTCHours()).padStart(2, '0')
    const minute = String(jstTime.getUTCMinutes()).padStart(2, '0')
    return `${month}/${day} ${hour}:${minute}`
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">読み込み中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>通話履歴</CardTitle>
              <CardDescription>Zoom Phone通話の処理済みデータ一覧</CardDescription>
            </div>

            {/* Project Filter */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={selectedProjectId} onValueChange={handleProjectFilterChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="プロジェクトで絞り込み" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全てのプロジェクト</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Phone className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p>通話履歴がありません</p>
              <p className="mt-2 text-sm">Zoom Phoneで通話を行うと、ここに表示されます</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>発信者</TableHead>
                  <TableHead>着信先</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>フィードバック</TableHead>
                  <TableHead>プロジェクト</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map(call => (
                  <TableRow key={call.id}>
                    <TableCell className="font-medium">{formatDate(call.call_time)}</TableCell>
                    <TableCell>{call.user?.name || call.caller_number || 'N/A'}</TableCell>
                    <TableCell>{call.callee_number || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="mr-1 h-3 w-3 text-gray-500" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell>
                      {call.feedback_text ? (
                        <Badge variant="outline" className="bg-blue-50">
                          あり
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">
                          なし
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{call.project ? call.project.name : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/calls/${call.id}`)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        詳細
                      </Button>
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
