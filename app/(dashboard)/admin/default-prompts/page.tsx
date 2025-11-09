'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, History, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Prompt {
  id: string
  prompt_type: string
  content: string
  version: number
  is_active: boolean
  change_comment: string | null
  created_at: string
  created_by: string
  users: {
    id: string
    name: string
    email: string
  }
}

export default function DefaultPromptsPage() {
  const router = useRouter()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'connected' | 'reception'>('connected')

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/default-prompts')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'デフォルトプロンプトの取得に失敗しました')
      }

      setPrompts(result.data.items)
    } catch (err: any) {
      console.error('Error fetching default prompts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getPromptByType = (type: 'connected' | 'reception'): Prompt | undefined => {
    return prompts.find(p => p.prompt_type === type && p.is_active)
  }

  const handleEdit = (promptId: string) => {
    router.push(`/admin/default-prompts/${promptId}/edit`)
  }

  const handleViewHistory = (promptId: string) => {
    router.push(`/admin/default-prompts/${promptId}/history`)
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

  const connectedPrompt = getPromptByType('connected')
  const receptionPrompt = getPromptByType('reception')

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        ホームに戻る
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">システムデフォルトプロンプト管理</h1>
        <p className="mt-2 text-muted-foreground">
          全プロジェクトで使用されるデフォルトプロンプトを管理します
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">エラー</p>
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">システムデフォルトプロンプトについて</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-blue-800">
                <li>ここで設定したプロンプトは、全プロジェクトのデフォルトとして使用されます</li>
                <li>各プロジェクトで個別にプロンプトをカスタマイズすることも可能です</li>
                <li>
                  カスタマイズしていないプロジェクトは、自動的にこのデフォルトプロンプトを使用します
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={value => setSelectedTab(value as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connected">
            Connected用
            {connectedPrompt && (
              <span className="ml-2 text-xs text-muted-foreground">
                (v{connectedPrompt.version})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reception">
            Reception用
            {receptionPrompt && (
              <span className="ml-2 text-xs text-muted-foreground">
                (v{receptionPrompt.version})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="mt-6">
          {connectedPrompt ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Connected通話用プロンプト</CardTitle>
                    <CardDescription>
                      60秒以上の通話に使用されるフィードバックプロンプト
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(connectedPrompt.id)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      履歴
                    </Button>
                    <Button size="sm" onClick={() => handleEdit(connectedPrompt.id)}>
                      <Edit className="mr-2 h-4 w-4" />
                      編集
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      最終更新: {new Date(connectedPrompt.created_at).toLocaleString('ja-JP')} by{' '}
                      {connectedPrompt.users.name}
                    </p>
                    {connectedPrompt.change_comment && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        変更コメント: {connectedPrompt.change_comment}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border p-4">
                    <h3 className="mb-2 font-semibold">プロンプト内容</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{connectedPrompt.content}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    文字数: {connectedPrompt.content.length} 文字
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  Connected用のデフォルトプロンプトが設定されていません
                </p>
                <Button className="mt-4" onClick={() => router.push('/admin/default-prompts/new')}>
                  プロンプトを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reception" className="mt-6">
          {receptionPrompt ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Reception通話用プロンプト</CardTitle>
                    <CardDescription>
                      受付止まり通話に使用されるフィードバックプロンプト
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(receptionPrompt.id)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      履歴
                    </Button>
                    <Button size="sm" onClick={() => handleEdit(receptionPrompt.id)}>
                      <Edit className="mr-2 h-4 w-4" />
                      編集
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      最終更新: {new Date(receptionPrompt.created_at).toLocaleString('ja-JP')} by{' '}
                      {receptionPrompt.users.name}
                    </p>
                    {receptionPrompt.change_comment && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        変更コメント: {receptionPrompt.change_comment}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border p-4">
                    <h3 className="mb-2 font-semibold">プロンプト内容</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{receptionPrompt.content}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    文字数: {receptionPrompt.content.length} 文字
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  Reception用のデフォルトプロンプトが設定されていません
                </p>
                <Button className="mt-4" onClick={() => router.push('/admin/default-prompts/new')}>
                  プロンプトを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
