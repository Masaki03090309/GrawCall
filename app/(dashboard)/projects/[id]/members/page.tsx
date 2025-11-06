'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Trash2, UserPlus, Shield, User } from 'lucide-react'

interface Member {
  user_id: string
  role: string
  created_at: string
  users: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface AllUser {
  id: string
  name: string
  email: string
  role: string
}

export default function ProjectMembersPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AllUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserEmail, setSelectedUserEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'director' | 'user'>('user')
  const [showDropdown, setShowDropdown] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      await fetchUserRole()
      await fetchMembers()
    }
    loadData()
  }, [projectId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.user-search-container')) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/user')
      const result = await response.json()

      if (result.success && result.data) {
        setUserRole(result.data.role)

        // Only owner can add members, so only fetch all users for owner
        if (result.data.role === 'owner') {
          await fetchAllUsers()
        }
      }
    } catch (err: any) {
      console.error('Error fetching user role:', err)
    }
  }

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/projects/${projectId}/members`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'メンバーの取得に失敗しました')
      }

      setMembers(result.data.items)

      // Refresh available users if owner
      if (userRole === 'owner') {
        await fetchAllUsers()
      }
    } catch (err: any) {
      console.error('Error fetching members:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const result = await response.json()

      if (response.ok) {
        // Filter out users who are already members
        const memberIds = members.map(m => m.user_id)
        const availableUsers = result.data.items.filter(
          (user: AllUser) => !memberIds.includes(user.id)
        )
        setAllUsers(availableUsers)
        setFilteredUsers(availableUsers)
      }
    } catch (err: any) {
      console.error('Error fetching all users:', err)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setSelectedUserId('')
    setSelectedUserEmail('')
    setShowDropdown(true)

    if (value.trim() === '') {
      setFilteredUsers(allUsers)
    } else {
      const filtered = allUsers.filter(
        user =>
          user.email.toLowerCase().includes(value.toLowerCase()) ||
          user.name.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }

  const handleUserSelect = (user: AllUser) => {
    setSelectedUserId(user.id)
    setSelectedUserEmail(user.email)
    setSearchTerm(user.email)
    setShowDropdown(false)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      setError('ユーザーを選択してください')
      return
    }

    setAdding(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: newMemberRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'メンバーの追加に失敗しました')
      }

      setShowAddDialog(false)
      setSelectedUserId('')
      setSelectedUserEmail('')
      setSearchTerm('')
      setNewMemberRole('user')
      setShowDropdown(false)
      await fetchMembers()
      await fetchAllUsers()
    } catch (err: any) {
      console.error('Error adding member:', err)
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToDelete) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberToDelete.user_id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'メンバーの削除に失敗しました')
      }

      setShowDeleteDialog(false)
      setMemberToDelete(null)
      await fetchMembers()
    } catch (err: any) {
      console.error('Error removing member:', err)
      setError(err.message)
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    if (role === 'director') {
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <Shield className="h-4 w-4" />
          <span className="font-medium">ディレクター</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-gray-600">
        <User className="h-4 w-4" />
        <span>ユーザー</span>
      </div>
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

  return (
    <div className="container mx-auto max-w-6xl py-8">
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
              <CardTitle>メンバー一覧</CardTitle>
              <CardDescription>
                {userRole === 'owner'
                  ? 'プロジェクトメンバーの追加・削除とロール管理'
                  : 'プロジェクトメンバーの確認'}
              </CardDescription>
            </div>
            {userRole === 'owner' && (
              <Button onClick={() => setShowAddDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                メンバーを追加
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">メンバーがいません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>ロール</TableHead>
                  <TableHead>システムロール</TableHead>
                  <TableHead>追加日</TableHead>
                  {userRole === 'owner' && <TableHead className="text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(member => (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">{member.users.name}</TableCell>
                    <TableCell>{member.users.email}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      <span className="capitalize">{member.users.role}</span>
                    </TableCell>
                    <TableCell>{new Date(member.created_at).toLocaleDateString('ja-JP')}</TableCell>
                    {userRole === 'owner' && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setMemberToDelete(member)
                            setShowDeleteDialog(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メンバーを追加</AlertDialogTitle>
            <AlertDialogDescription>
              プロジェクトに新しいメンバーを追加します
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleAddMember}>
            <div className="space-y-4 py-4">
              <div className="user-search-container relative space-y-2">
                <Label htmlFor="search_user">
                  ユーザー検索 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="search_user"
                  type="text"
                  placeholder="メールアドレスまたは名前で検索..."
                  value={searchTerm}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  disabled={adding}
                  autoComplete="off"
                />
                {selectedUserEmail && (
                  <p className="text-sm text-green-600">選択中: {selectedUserEmail}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  クリックして全ユーザーを表示、または入力して検索
                </p>

                {/* Dropdown */}
                {showDropdown && !adding && (
                  <div className="absolute z-50 mt-1 max-h-[300px] w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        ユーザーが見つかりません
                      </div>
                    ) : (
                      <div className="py-1">
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            className="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleUserSelect(user)}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{user.email}</span>
                              <span className="text-xs text-muted-foreground">
                                {user.name} • {user.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  ロール <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newMemberRole}
                  onValueChange={(value: 'director' | 'user') => setNewMemberRole(value)}
                  disabled={adding}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">ユーザー</SelectItem>
                    <SelectItem value="director">ディレクター</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  ディレクターはプロジェクトを管理できます
                </p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={adding}>キャンセル</AlertDialogCancel>
              <Button type="submit" disabled={adding || !selectedUserId}>
                {adding ? '追加中...' : '追加'}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Member Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メンバーを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete?.users.name} ({memberToDelete?.users.email})
              をプロジェクトから削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
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
