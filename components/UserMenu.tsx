'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UserMenuProps {
  userName: string
  userEmail: string
}

export default function UserMenu({ userName, userEmail }: UserMenuProps) {
  return (
    <Link href="/profile">
      <Button variant="ghost" className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span className="hidden md:inline">{userName}</span>
      </Button>
    </Link>
  )
}
