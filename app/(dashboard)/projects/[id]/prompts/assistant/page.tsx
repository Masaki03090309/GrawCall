'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Sparkles, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function PromptAssistantPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const projectId = params.id as string
  const promptType = (searchParams.get('type') || 'connected') as 'connected' | 'reception'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [improvements, setImprovements] = useState<string[]>([])
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 初回メッセージ
  useEffect(() => {
    const initialMessage: Message = {
      role: 'assistant',
      content: `こんにちは！プロンプトアシスタントです。

現在、このプロジェクトでは**システムデフォルトのプロンプト**を使用しています。

現在の架電フィードバックに**修正点や改善したいこと**はありますか？

例：
• 「ヒアリングの評価を厳しくしたい」
• 「展示会特化の評価を追加したい」
• 「アポ取りの基準を明確にしたい」

⏱️ **ご注意**: AIの回答には30秒弱かかります。お待ちください。`,
    }
    setMessages([initialMessage])
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isSending) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsSending(true)

    try {
      const response = await fetch('/api/prompts/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          prompt_type: promptType,
          user_message: input,
          conversation_history: messages,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'メッセージの送信に失敗しました')
      }

      // AIメッセージを追加
      const aiMsg: Message = { role: 'assistant', content: result.data.ai_message }
      setMessages(prev => [...prev, aiMsg])

      // 改善点リスト更新
      if (result.data.improvements) {
        setImprovements(result.data.improvements)
      }

      // プロンプト生成準備完了？
      if (result.data.ready_to_generate) {
        setIsReadyToGenerate(true)
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleGeneratePrompt = async () => {
    setIsGenerating(true)

    try {
      const response = await fetch('/api/prompts/assistant/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          prompt_type: promptType,
          conversation_history: messages,
          improvements,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'プロンプトの生成に失敗しました')
      }

      toast({
        title: 'プロンプト作成完了！',
        description: 'プロジェクト専用のプロンプトを作成しました',
      })

      // プロンプト管理画面に戻る
      router.push(`/projects/${projectId}/prompts`)
    } catch (error: any) {
      console.error('Error generating prompt:', error)
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      {/* ヘッダー + プロンプト生成ボタン */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/prompts`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロンプト管理に戻る
          </Button>
          <h1 className="mt-4 text-3xl font-bold">プロンプトアシスタント</h1>
          <p className="mt-2 text-muted-foreground">
            対話しながらプロジェクト専用のプロンプトを作成します（
            {promptType === 'connected' ? 'Connected用' : 'Reception用'}）
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleGeneratePrompt}
          disabled={!isReadyToGenerate || isGenerating}
          className={isReadyToGenerate ? 'animate-pulse bg-gradient-to-r from-purple-600 to-blue-600' : ''}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              GPT-5で生成中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              改善内容をまとめて
              <br />
              プロンプトを作成
            </>
          )}
        </Button>
      </div>

      {/* メインエリア */}
      <div className="grid grid-cols-3 gap-6">
        {/* チャットエリア（2/3幅） */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>対話エリア</CardTitle>
            <CardDescription>改善したい内容を自由に伝えてください</CardDescription>
          </CardHeader>
          <CardContent>
            {/* チャット履歴 */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="mb-1 text-xs opacity-70">
                        {msg.role === 'user' ? '👤 あなた' : '🤖 アシスタント'}
                      </div>
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg bg-gray-100 p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 入力欄 */}
            <div className="mt-4 space-y-2">
              <Textarea
                placeholder="改善したいことを入力してください..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending || isGenerating}
                rows={3}
              />
              <Button
                onClick={sendMessage}
                className="w-full"
                disabled={!input.trim() || isSending || isGenerating}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSending ? '送信中...' : '送信'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 改善内容サマリー（1/3幅） */}
        <Card>
          <CardHeader>
            <CardTitle>改善内容まとめ</CardTitle>
            <CardDescription>会話から抽出された改善点</CardDescription>
          </CardHeader>
          <CardContent>
            {improvements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                改善したい内容を伝えると、ここに要約が表示されます
              </p>
            ) : (
              <div className="space-y-2">
                {improvements.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}

                {isReadyToGenerate && (
                  <div className="mt-4 rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-800">
                      ✨ 準備完了！上部のボタンを押してプロンプトを生成してください
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
