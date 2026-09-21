'use client'

import { useAuth } from '@/lib/auth-context'

export default function AppHeader() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <header className="border-b bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="text-lg font-semibold">WorksiteID</div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">
              {user.name} {user.surname}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {user.userType}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
