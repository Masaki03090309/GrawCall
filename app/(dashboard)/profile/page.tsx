'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  name: string | null
  role: 'owner' | 'director' | 'user'
  zoom_user_id: string | null
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !authUser) {
        router.push('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (fetchError) throw fetchError

      setUser(data)
      setName(data.name || '')
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError('プロフィール情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      setSaving(true)

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error?.message || 'プロフィールの更新に失敗しました')
        return
      }

      setSuccess(true)
      setUser(result.data)

      // Success message will auto-hide after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError('プロフィールの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-purple-500">オーナー</Badge>
      case 'director':
        return <Badge className="bg-blue-500">ディレクター</Badge>
      case 'user':
        return <Badge className="bg-gray-500">ユーザー</Badge>
      default:
        return <Badge>不明</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">ユーザー情報が見つかりません</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
      </div>

      {/* Profile Edit Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>プロフィール設定</CardTitle>
              <CardDescription>ユーザー情報を編集できます</CardDescription>
            </div>
            <UserIcon className="h-8 w-8 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" value={user.email} disabled className="bg-gray-50" />
              <p className="text-sm text-gray-500">メールアドレスは変更できません</p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                名前 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="山田 太郎"
                required
                maxLength={255}
              />
              <p className="text-sm text-gray-500">通話履歴などに表示される名前です</p>
            </div>

            {/* Role (Read-only) */}
            <div className="space-y-2">
              <Label>権限</Label>
              <div>{getRoleBadge(user.role)}</div>
              <p className="text-sm text-gray-500">権限はオーナーのみが変更できます</p>
            </div>

            {/* Zoom User ID (Read-only) */}
            {user.zoom_user_id && (
              <div className="space-y-2">
                <Label>Zoom User ID</Label>
                <Input type="text" value={user.zoom_user_id} disabled className="bg-gray-50" />
                <p className="text-sm text-gray-500">Zoom Phoneアカウントとの連携ID</p>
              </div>
            )}

            {/* Created At (Read-only) */}
            <div className="space-y-2">
              <Label>アカウント作成日</Label>
              <Input
                type="text"
                value={formatDate(user.created_at)}
                disabled
                className="bg-gray-50"
              />
            </div>

            {/* Error Message */}
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {/* Success Message */}
            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">
                プロフィールを更新しました
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
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
    </div>
  )
}
