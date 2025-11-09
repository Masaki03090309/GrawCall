'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, Save, AlertCircle, GripVertical } from 'lucide-react'
import dynamic from 'next/dynamic'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface HearingItem {
  item_name: string
  item_script: string
  is_default: boolean
  display_order: number
}

export default function NewTalkScriptPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [activePhase, setActivePhase] = useState<string>('opening')
  const [openingScript, setOpeningScript] = useState('')
  const [proposalScript, setProposalScript] = useState('')
  const [closingScript, setClosingScript] = useState('')
  const [hearingItems, setHearingItems] = useState<HearingItem[]>([
    {
      item_name: '現在の課題',
      item_script: 'ご担当者様の現在の課題をお聞かせいただけますでしょうか？',
      is_default: true,
      display_order: 1,
    },
  ])
  const [changeComment, setChangeComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddHearingItem = () => {
    if (hearingItems.length >= 10) {
      setError('ヒアリング項目は最大10個までです')
      return
    }

    const newItem: HearingItem = {
      item_name: '',
      item_script: '',
      is_default: false,
      display_order: hearingItems.length + 1,
    }

    setHearingItems([...hearingItems, newItem])
    setError(null)
  }

  const handleRemoveHearingItem = (index: number) => {
    if (hearingItems[index].is_default) {
      setError('デフォルト項目は削除できません')
      return
    }

    const updatedItems = hearingItems.filter((_, i) => i !== index)
    // Re-order
    const reorderedItems = updatedItems.map((item, i) => ({
      ...item,
      display_order: i + 1,
    }))

    setHearingItems(reorderedItems)
    setError(null)
  }

  const handleUpdateHearingItem = (
    index: number,
    field: 'item_name' | 'item_script',
    value: string
  ) => {
    const updatedItems = [...hearingItems]
    updatedItems[index][field] = value
    setHearingItems(updatedItems)
  }

  const handleMoveHearingItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === hearingItems.length - 1)
    ) {
      return
    }

    const updatedItems = [...hearingItems]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    // Swap
    ;[updatedItems[index], updatedItems[targetIndex]] = [
      updatedItems[targetIndex],
      updatedItems[index],
    ]

    // Re-order
    const reorderedItems = updatedItems.map((item, i) => ({
      ...item,
      display_order: i + 1,
    }))

    setHearingItems(reorderedItems)
  }

  const validateForm = (): boolean => {
    // Check if at least one phase has content
    if (!openingScript && !proposalScript && !closingScript && hearingItems.length === 0) {
      setError('少なくとも1つのフェーズの内容を入力してください')
      return false
    }

    // Validate hearing items
    for (const item of hearingItems) {
      if (!item.item_name || !item.item_script) {
        setError('ヒアリング項目の名前とスクリプトを入力してください')
        return false
      }
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/talk-scripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          opening_script: openingScript || null,
          proposal_script: proposalScript || null,
          closing_script: closingScript || null,
          hearing_items: hearingItems,
          change_comment: changeComment || 'Initial version',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create talk script')
      }

      // Redirect to talk scripts page
      router.push(`/projects/${projectId}/talk-scripts`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">トークスクリプトを作成</h1>
          <p className="mt-2 text-gray-600">各フェーズのトークスクリプトを入力してください</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/talk-scripts`)}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>変更コメント</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="変更内容を記録してください（例: 初回作成、○○フェーズを更新）"
            value={changeComment}
            onChange={e => setChangeComment(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>トークスクリプト内容</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activePhase} onValueChange={setActivePhase}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="opening">オープニング</TabsTrigger>
              <TabsTrigger value="hearing">
                ヒアリング
                <Badge variant="secondary" className="ml-2">
                  {hearingItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="proposal">提案</TabsTrigger>
              <TabsTrigger value="closing">クロージング</TabsTrigger>
            </TabsList>

            <TabsContent value="opening" className="mt-4">
              <div className="space-y-2">
                <Label>オープニングスクリプト</Label>
                <p className="text-sm text-gray-600">
                  自己紹介、アイスブレイク、通話の目的説明などを記載してください
                </p>
                <MDEditor
                  value={openingScript}
                  onChange={val => setOpeningScript(val || '')}
                  height={400}
                  preview="edit"
                />
                <p className="text-sm text-gray-500">{openingScript.length} 文字</p>
              </div>
            </TabsContent>

            <TabsContent value="hearing" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>ヒアリング項目</Label>
                    <p className="mt-1 text-sm text-gray-600">最大10項目まで設定できます</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddHearingItem}
                    disabled={hearingItems.length >= 10}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    項目を追加
                  </Button>
                </div>

                <div className="space-y-4">
                  {hearingItems.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-gray-400" />
                            <span className="font-semibold">項目 {index + 1}</span>
                            {item.is_default && <Badge variant="secondary">デフォルト</Badge>}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveHearingItem(index, 'up')}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveHearingItem(index, 'down')}
                              disabled={index === hearingItems.length - 1}
                            >
                              ↓
                            </Button>
                            {!item.is_default && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveHearingItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>項目名</Label>
                          <Input
                            placeholder="例: 現在の課題"
                            value={item.item_name}
                            onChange={e =>
                              handleUpdateHearingItem(index, 'item_name', e.target.value)
                            }
                            disabled={item.is_default}
                          />
                        </div>
                        <div>
                          <Label>スクリプト</Label>
                          <Textarea
                            placeholder="例: ご担当者様の現在の課題をお聞かせいただけますでしょうか？"
                            value={item.item_script}
                            onChange={e =>
                              handleUpdateHearingItem(index, 'item_script', e.target.value)
                            }
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="proposal" className="mt-4">
              <div className="space-y-2">
                <Label>提案スクリプト</Label>
                <p className="text-sm text-gray-600">
                  商品説明、価値提案、ベネフィット説明などを記載してください
                </p>
                <MDEditor
                  value={proposalScript}
                  onChange={val => setProposalScript(val || '')}
                  height={400}
                  preview="edit"
                />
                <p className="text-sm text-gray-500">{proposalScript.length} 文字</p>
              </div>
            </TabsContent>

            <TabsContent value="closing" className="mt-4">
              <div className="space-y-2">
                <Label>クロージングスクリプト</Label>
                <p className="text-sm text-gray-600">
                  アポイント打診、次回アクション提示などを記載してください
                </p>
                <MDEditor
                  value={closingScript}
                  onChange={val => setClosingScript(val || '')}
                  height={400}
                  preview="edit"
                />
                <p className="text-sm text-gray-500">{closingScript.length} 文字</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
