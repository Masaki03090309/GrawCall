'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugUserInfo() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [projectMemberships, setProjectMemberships] = useState<any[]>([])

  useEffect(() => {
    async function fetchDebugInfo() {
      // Get user info
      const userRes = await fetch('/api/auth/user')
      const userData = await userRes.json()
      setUserInfo(userData.data)

      // Get project memberships
      const projectsRes = await fetch('/api/projects')
      const projectsData = await projectsRes.json()

      if (projectsData.success && projectsData.data?.items) {
        const memberships = projectsData.data.items.flatMap((project: any) =>
          project.project_members?.map((member: any) => ({
            projectName: project.name,
            role: member.role,
            userName: member.users?.name,
          })) || []
        )
        setProjectMemberships(memberships)
      }
    }

    fetchDebugInfo()
  }, [])

  if (!userInfo) return <div>Loading...</div>

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>🔍 デバッグ: ユーザー権限情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div>
            <h3 className="mb-2 font-semibold">ユーザー情報</h3>
            <div className="rounded-md bg-gray-100 p-4 font-mono text-sm">
              <div>名前: {userInfo.name}</div>
              <div>Email: {userInfo.email}</div>
              <div className="mt-2 text-lg font-bold">
                ロール: <span className="text-blue-600">{userInfo.role}</span>
              </div>
            </div>
          </div>

          {/* Permission Explanation */}
          <div>
            <h3 className="mb-2 font-semibold">権限レベル</h3>
            <div className="space-y-2">
              {userInfo.role === 'owner' && (
                <div className="rounded-md border-2 border-green-500 bg-green-50 p-4">
                  <div className="font-bold text-green-700">✅ オーナー権限</div>
                  <div className="mt-1 text-sm text-green-600">
                    全プロジェクトの全通話を閲覧できます
                  </div>
                </div>
              )}

              {userInfo.role === 'director' && (
                <div className="rounded-md border-2 border-blue-500 bg-blue-50 p-4">
                  <div className="font-bold text-blue-700">🔷 ディレクター権限</div>
                  <div className="mt-1 text-sm text-blue-600">
                    所属プロジェクトの全通話を閲覧できます
                  </div>
                </div>
              )}

              {userInfo.role === 'user' && (
                <div className="rounded-md border-2 border-yellow-500 bg-yellow-50 p-4">
                  <div className="font-bold text-yellow-700">👤 一般ユーザー権限</div>
                  <div className="mt-1 text-sm text-yellow-600">
                    自分の通話のみ閲覧できます
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Project Memberships */}
          {projectMemberships.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">プロジェクト所属状況</h3>
              <div className="space-y-2">
                {projectMemberships
                  .filter((m) => m.userName === userInfo.name)
                  .map((membership, i) => (
                    <div key={i} className="rounded-md bg-gray-100 p-3">
                      <div className="font-medium">{membership.projectName}</div>
                      <div className="text-sm text-gray-600">
                        ロール: {membership.role}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
