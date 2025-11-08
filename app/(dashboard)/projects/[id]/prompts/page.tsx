'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, Eye, Sparkles } from 'lucide-react'

interface Prompt {
  id: string
  project_id: string | null
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
  const router = useRouter()
  const projectId = params.id as string

  const [connectedPrompt, setConnectedPrompt] = useState<Prompt | null>(null)
  const [receptionPrompt, setReceptionPrompt] = useState<Prompt | null>(null)
  const [defaultConnectedPrompt, setDefaultConnectedPrompt] = useState<Prompt | null>(null)
  const [defaultReceptionPrompt, setDefaultReceptionPrompt] = useState<Prompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchPrompts()
  }, [projectId])

  const fetchPrompts = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch project-specific connected prompt
      const connectedRes = await fetch(
        `/api/prompts?project_id=${projectId}&prompt_type=connected&is_active=true`
      )
      const connectedData = await connectedRes.json()

      if (connectedData.success && connectedData.data.items.length > 0) {
        setConnectedPrompt(connectedData.data.items[0])
      }

      // Fetch project-specific reception prompt
      const receptionRes = await fetch(
        `/api/prompts?project_id=${projectId}&prompt_type=reception&is_active=true`
      )
      const receptionData = await receptionRes.json()

      if (receptionData.success && receptionData.data.items.length > 0) {
        setReceptionPrompt(receptionData.data.items[0])
      }

      // Fetch system default connected prompt
      const defaultConnectedRes = await fetch(
        `/api/prompts?project_id=null&prompt_type=connected&is_active=true`
      )
      const defaultConnectedData = await defaultConnectedRes.json()

      if (defaultConnectedData.success && defaultConnectedData.data.items.length > 0) {
        setDefaultConnectedPrompt(defaultConnectedData.data.items[0])
      }

      // Fetch system default reception prompt
      const defaultReceptionRes = await fetch(
        `/api/prompts?project_id=null&prompt_type=reception&is_active=true`
      )
      const defaultReceptionData = await defaultReceptionRes.json()

      if (defaultReceptionData.success && defaultReceptionData.data.items.length > 0) {
        setDefaultReceptionPrompt(defaultReceptionData.data.items[0])
      }
    } catch (err: any) {
      console.error('Error fetching prompts:', err)
      setError(err.message || 'プロンプトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const viewPrompt = (prompt: Prompt | null) => {
    if (!prompt) return
    setViewingPrompt(prompt)
    setIsDialogOpen(true)
  }

  const renderPromptCard = (
    title: string,
    description: string,
    promptType: 'connected' | 'reception',
    customPrompt: Prompt | null,
    defaultPrompt: Prompt | null
  ) => {
    const isCustomized = customPrompt !== null
    const displayPrompt = customPrompt || defaultPrompt

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {isCustomized ? (
            // カスタマイズ済み
            <>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="default">カスタマイズ済み</Badge>
                <span className="text-sm text-muted-foreground">
                  最終更新: {displayPrompt ? new Date(displayPrompt.created_at).toLocaleDateString('ja-JP') : ''}
                </span>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() =>
                    router.push(`/projects/${projectId}/prompts/assistant?type=${promptType}`)
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  さらに改善する
                </Button>
                <Button variant="outline" onClick={() => viewPrompt(displayPrompt)}>
                  <Eye className="mr-2 h-4 w-4" />
                  プロンプトを確認
                </Button>
              </div>
            </>
          ) : (
            // システムデフォルト使用中
            <>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline">システムデフォルト使用中</Badge>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                現在はシステム共通のプロンプトを使用しています。
                プロンプトアシスタントで、このプロジェクト専用にカスタマイズできます。
              </p>

              <Button
                onClick={() =>
                  router.push(`/projects/${projectId}/prompts/assistant?type=${promptType}`)
                }
              >
                <Sparkles className="mr-2 h-4 w-4" />
                プロンプトアシスタントで改善する
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
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

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchPrompts}>再試行</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">プロンプト管理</h1>
        <p className="mt-2 text-muted-foreground">
          AIフィードバック生成に使用するプロンプトを管理します
        </p>
      </div>

      <div className="space-y-6">
        {/* Connected用プロンプト */}
        {renderPromptCard(
          'Connected用プロンプト',
          '担当者につながった通話のフィードバック生成に使用されます',
          'connected',
          connectedPrompt,
          defaultConnectedPrompt
        )}

        {/* Reception用プロンプト */}
        {renderPromptCard(
          'Reception用プロンプト',
          '受付に当たった通話のフィードバック生成に使用されます',
          'reception',
          receptionPrompt,
          defaultReceptionPrompt
        )}
      </div>

      {/* プロンプト表示ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>プロンプト内容</DialogTitle>
            <DialogDescription>
              {viewingPrompt?.prompt_type === 'connected'
                ? 'Connected用プロンプト'
                : 'Reception用プロンプト'}
              {' - '}
              バージョン: {viewingPrompt?.version}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[600px] w-full rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm">{viewingPrompt?.content}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
