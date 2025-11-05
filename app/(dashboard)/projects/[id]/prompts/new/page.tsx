'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import AudioRecorder from '@/components/AudioRecorder'

// Import markdown editor dynamically to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

export default function NewPromptPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const typeParam = searchParams.get('type') as 'connected' | 'reception' | null

  const [promptType, setPromptType] = useState<'connected' | 'reception'>(typeParam || 'connected')
  const [content, setContent] = useState('')
  const [changeComment, setChangeComment] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [additionalContext, setAdditionalContext] = useState('')

  const characterCount = content.length

  const handleRecordingComplete = async (_audioBlob: Blob, audioBase64: string) => {
    setGeneratingPrompt(true)
    setError(null)

    try {
      toast.info('音声を文字起こししています...')

      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: audioBase64,
          prompt_type: promptType,
          additional_context: additionalContext || undefined,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'プロンプト生成に失敗しました')
      }

      setTranscription(data.data.transcription)
      setContent(data.data.generated_prompt)

      toast.success('プロンプトを生成しました！内容を確認して保存してください。')
    } catch (err: any) {
      console.error('Error generating prompt:', err)
      toast.error(err.message || 'プロンプトの生成に失敗しました')
      setError(err.message || 'プロンプトの生成に失敗しました')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          prompt_type: promptType,
          content,
          change_comment: changeComment || undefined,
          is_active: isActive,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create prompt')
      }

      toast.success('プロンプトを作成しました')
      // Redirect to prompts list
      router.push(`/projects/${projectId}/prompts`)
    } catch (err: any) {
      console.error('Error creating prompt:', err)
      setError(err.message || 'プロンプトの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${projectId}/prompts`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロンプト一覧に戻る
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-purple-900">AIプロンプトアシスタント</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
              >
                {showAIAssistant ? (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    閉じる
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    開く
                  </>
                )}
              </Button>
            </div>
            <CardDescription className="text-purple-700">
              音声を録音するだけで、AIが自動的にプロンプトを生成します
            </CardDescription>
          </CardHeader>
          {showAIAssistant && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="additional-context">追加コンテキスト（任意）</Label>
                <Textarea
                  id="additional-context"
                  value={additionalContext}
                  onChange={e => setAdditionalContext(e.target.value)}
                  placeholder="プロンプトに含めたい特定の要件や重視すべきポイントを記載してください"
                  rows={3}
                  disabled={generatingPrompt}
                />
              </div>

              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                maxDurationSeconds={300}
              />

              {generatingPrompt && (
                <div className="flex items-center justify-center gap-2 rounded-md bg-white p-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-purple-600"></div>
                  <span className="text-sm text-gray-600">AIがプロンプトを生成しています...</span>
                </div>
              )}

              {transcription && (
                <div className="space-y-2">
                  <Label>文字起こし結果</Label>
                  <div className="rounded-md border bg-white p-4">
                    <p className="whitespace-pre-wrap text-sm">{transcription}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    文字起こしを修正したい場合は、上記テキストを編集してから再生成してください
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新しいプロンプトを作成</CardTitle>
          <CardDescription>
            AIフィードバック生成に使用するプロンプトを作成します（手動入力またはAIアシスタントで生成）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="prompt-type">プロンプトタイプ *</Label>
              <Select value={promptType} onValueChange={(value: any) => setPromptType(value)}>
                <SelectTrigger id="prompt-type">
                  <SelectValue placeholder="プロンプトタイプを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">つながった通話用（connected）</SelectItem>
                  <SelectItem value="reception">受付に当たった通話用（reception）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                通話状態に応じて使用されるプロンプトのタイプを選択します
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">プロンプト内容 *</Label>
                <span className="text-sm text-gray-500">
                  {characterCount.toLocaleString()} 文字
                </span>
              </div>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={val => setContent(val || '')}
                  height={400}
                  preview="edit"
                  textareaProps={{
                    placeholder: 'プロンプト内容を入力してください...',
                  }}
                />
              </div>
              <p className="text-sm text-gray-500">
                AIにフィードバック生成を指示するプロンプトを記述します（マークダウン記法対応）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-comment">変更コメント</Label>
              <Textarea
                id="change-comment"
                value={changeComment}
                onChange={e => setChangeComment(e.target.value)}
                placeholder="この変更の理由や目的を記載（任意）"
                rows={3}
              />
              <p className="text-sm text-gray-500">
                このバージョンの変更内容を記録します（履歴管理に使用）
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is-active" className="cursor-pointer">
                このプロンプトをアクティブにする
              </Label>
            </div>
            <p className="ml-6 text-sm text-gray-500">
              アクティブなプロンプトが実際のAIフィードバック生成に使用されます。
              同じタイプの既存のアクティブプロンプトは自動的に非アクティブになります。
            </p>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading || !content.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? '作成中...' : 'プロンプトを作成'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/projects/${projectId}/prompts`}>キャンセル</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
