'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Shield, User as UserIcon, Crown, Edit2, Check, X, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'director' | 'user'
  zoom_user_id: string | null
  created_at: string
  updated_at: string
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [editingZoomId, setEditingZoomId] = useState<string | null>(null)
  const [editingZoomValue, setEditingZoomValue] = useState<string>('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user info
      const currentUserResponse = await fetch('/api/auth/me')
      const currentUserResult = await currentUserResponse.json()
      const currentId = currentUserResult.data?.id
      setCurrentUserId(currentId)

      // Get all users
      const response = await fetch('/api/users')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'ユーザーの取得に失敗しました')
      }

      // Sort users: current user first, then by role (owner > director > user), then by email
      const sortedUsers = result.data.items.sort((a: User, b: User) => {
        // Current user always first
        if (a.id === currentId) return -1
        if (b.id === currentId) return 1

        // Then by role priority
        const roleOrder = { owner: 0, director: 1, user: 2 }
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role]
        }

        // Finally by email
        return a.email.localeCompare(b.email)
      })

      setUsers(sortedUsers)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'ロールの更新に失敗しました')
      }

      // Update local state
      setUsers(
        users.map(user => (user.id === userId ? { ...user, role: newRole as User['role'] } : user))
      )
    } catch (err: any) {
      console.error('Error updating role:', err)
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleStartEditZoomId = (userId: string, currentZoomId: string | null) => {
    setEditingZoomId(userId)
    setEditingZoomValue(currentZoomId || '')
  }

  const handleCancelEditZoomId = () => {
    setEditingZoomId(null)
    setEditingZoomValue('')
  }

  const handleSaveZoomId = async (userId: string) => {
    setUpdating(userId)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ zoom_user_id: editingZoomValue || null }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Zoom User IDの更新に失敗しました')
      }

      // Update local state
      setUsers(
        users.map(user =>
          user.id === userId ? { ...user, zoom_user_id: editingZoomValue || null } : user
        )
      )

      setEditingZoomId(null)
      setEditingZoomValue('')
    } catch (err: any) {
      console.error('Error updating Zoom User ID:', err)
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'ユーザーの削除に失敗しました')
      }

      // Remove user from local state
      setUsers(users.filter(user => user.id !== userToDelete.id))

      setShowDeleteDialog(false)
      setUserToDelete(null)
    } catch (err: any) {
      console.error('Error deleting user:', err)
      setError(err.message)
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <div className="flex items-center gap-1 text-purple-600">
            <Crown className="h-4 w-4" />
            <span className="font-medium">オーナー</span>
          </div>
        )
      case 'director':
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <Shield className="h-4 w-4" />
            <span className="font-medium">ディレクター</span>
          </div>
        )
      case 'user':
        return (
          <div className="flex items-center gap-1 text-gray-600">
            <UserIcon className="h-4 w-4" />
            <span>ユーザー</span>
          </div>
        )
      default:
        return <span>{role}</span>
    }
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

  if (error && users.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchUsers} className="mt-4">
              再試行
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ユーザー管理</h1>
        <p className="mt-2 text-muted-foreground">
          システム全体のユーザーロールを管理します（オーナーのみ）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>
            全ユーザーのロールを管理できます。オーナーは自分のロールを変更できません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">ユーザーがいません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>Zoom User ID</TableHead>
                  <TableHead>ロール</TableHead>
                  <TableHead>登録日</TableHead>
                  <TableHead>ロール変更</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const isCurrentUser = user.id === currentUserId
                  const isCurrentUserOwner = isCurrentUser && user.role === 'owner'

                  return (
                    <TableRow key={user.id} className={isCurrentUser ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium">
                        {user.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">(あなた)</span>
                        )}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {editingZoomId === user.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingZoomValue}
                              onChange={e => setEditingZoomValue(e.target.value)}
                              placeholder="Zoom User ID"
                              className="w-[200px] font-mono text-sm"
                              disabled={updating === user.id}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveZoomId(user.id)}
                              disabled={updating === user.id}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEditZoomId}
                              disabled={updating === user.id}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-600">
                              {user.zoom_user_id || (
                                <span className="italic text-gray-400">未設定</span>
                              )}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditZoomId(user.id, user.zoom_user_id)}
                            >
                              <Edit2 className="h-4 w-4 text-gray-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString('ja-JP')}</TableCell>
                      <TableCell>
                        {isCurrentUserOwner ? (
                          <div className="text-sm text-muted-foreground">変更不可</div>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={value => handleRoleChange(user.id, value)}
                            disabled={updating === user.id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">オーナー</SelectItem>
                              <SelectItem value="director">ディレクター</SelectItem>
                              <SelectItem value="user">ユーザー</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isCurrentUser ? (
                          <div className="text-sm text-muted-foreground">削除不可</div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUserToDelete(user)
                              setShowDeleteDialog(true)
                            }}
                            disabled={deleting}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>ロールの説明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Crown className="mt-0.5 h-5 w-5 text-purple-600" />
              <div>
                <h3 className="font-medium">オーナー</h3>
                <p className="text-sm text-muted-foreground">
                  システム全体を管理できます。全プロジェクト・全ユーザー・全通話にアクセス可能。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium">ディレクター</h3>
                <p className="text-sm text-muted-foreground">
                  プロジェクトを作成でき、自分のプロジェクトを管理できます。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserIcon className="mt-0.5 h-5 w-5 text-gray-600" />
              <div>
                <h3 className="font-medium">ユーザー</h3>
                <p className="text-sm text-muted-foreground">
                  自分の通話記録のみを閲覧できます。プロジェクト作成はできません。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ユーザーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete?.name} ({userToDelete?.email})
              を完全に削除します。この操作は取り消せません。
              <br />
              <br />
              <strong className="text-destructive">
                このユーザーに関連する全てのデータ（プロジェクトメンバーシップ、作成したプロンプトなど）も削除されます。
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
