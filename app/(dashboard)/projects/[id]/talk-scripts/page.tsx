'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, FileText, Clock, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface HearingItem {
  id: string
  item_name: string
  item_script: string
  is_default: boolean
  display_order: number
}

interface TalkScript {
  id: string
  project_id: string
  version: number
  opening_script: string | null
  proposal_script: string | null
  closing_script: string | null
  hearing_items: HearingItem[]
  created_by: {
    id: string
    name: string
  }
  created_at: string
}

export default function TalkScriptsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [talkScript, setTalkScript] = useState<TalkScript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<string>('opening')

  useEffect(() => {
    fetchTalkScript()
  }, [projectId])

  const fetchTalkScript = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/talk-scripts?project_id=${projectId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch talk script')
      }

      setTalkScript(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    router.push(`/projects/${projectId}/talk-scripts/new`)
  }

  const handleEdit = () => {
    if (talkScript) {
      router.push(`/projects/${projectId}/talk-scripts/${talkScript.id}/edit`)
    }
  }

  const handleViewHistory = () => {
    if (talkScript) {
      router.push(`/projects/${projectId}/talk-scripts/${talkScript.id}/history`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading talk script...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={fetchTalkScript} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!talkScript) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">トークスクリプト</h1>
            <p className="mt-2 text-gray-600">営業電話のトークスクリプトを管理します</p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-16 w-16 text-gray-400" />
            <h2 className="mb-2 text-xl font-semibold">トークスクリプトが未設定です</h2>
            <p className="mb-6 max-w-md text-center text-gray-600">
              トークスクリプトを作成して、通話内容との一致率分析を開始しましょう
            </p>
            <Button onClick={handleCreateNew} size="lg">
              <Plus className="mr-2 h-5 w-5" />
              トークスクリプトを作成
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">トークスクリプト</h1>
          <p className="mt-2 text-gray-600">現在のバージョン: v{talkScript.version}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleViewHistory}>
            <Clock className="mr-2 h-4 w-4" />
            履歴を表示
          </Button>
          <Button onClick={handleEdit}>編集</Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">バージョン</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">v{talkScript.version}</div>
            <Badge variant="default" className="mt-2">
              Active
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">作成者</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <User className="mr-2 h-5 w-5 text-gray-400" />
              <span className="text-lg font-medium">{talkScript.created_by.name}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">最終更新</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {new Date(talkScript.created_at).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>トークスクリプト内容</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activePhase} onValueChange={setActivePhase}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="opening">オープニング</TabsTrigger>
              <TabsTrigger value="hearing">ヒアリング</TabsTrigger>
              <TabsTrigger value="proposal">提案</TabsTrigger>
              <TabsTrigger value="closing">クロージング</TabsTrigger>
            </TabsList>

            <TabsContent value="opening" className="mt-4">
              <div className="prose max-w-none">
                {talkScript.opening_script ? (
                  <ReactMarkdown>{talkScript.opening_script}</ReactMarkdown>
                ) : (
                  <p className="italic text-gray-400">オープニングスクリプトが未設定です</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hearing" className="mt-4">
              <div className="space-y-4">
                {talkScript.hearing_items.length > 0 ? (
                  talkScript.hearing_items.map((item, index) => (
                    <div key={item.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center text-lg font-semibold">
                          <span className="mr-2 rounded bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            {index + 1}
                          </span>
                          {item.item_name}
                          {item.is_default && (
                            <Badge variant="secondary" className="ml-2">
                              デフォルト
                            </Badge>
                          )}
                        </h3>
                      </div>
                      <div className="prose max-w-none">
                        <ReactMarkdown>{item.item_script}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="italic text-gray-400">ヒアリング項目が未設定です</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="proposal" className="mt-4">
              <div className="prose max-w-none">
                {talkScript.proposal_script ? (
                  <ReactMarkdown>{talkScript.proposal_script}</ReactMarkdown>
                ) : (
                  <p className="italic text-gray-400">提案スクリプトが未設定です</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="closing" className="mt-4">
              <div className="prose max-w-none">
                {talkScript.closing_script ? (
                  <ReactMarkdown>{talkScript.closing_script}</ReactMarkdown>
                ) : (
                  <p className="italic text-gray-400">クロージングスクリプトが未設定です</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
