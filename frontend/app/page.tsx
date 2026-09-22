'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import LoginPage from '@/components/auth/login-page'

export default function Page() {
  const { isAuthenticated, user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user) {
        router.push(user.userType === 'worker' ? '/worker' : '/inspector')
      }
    }
  }, [isAuthenticated, user, loading, router])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Caricamento in corso...</div>
      </main>
    )
  }

  return <LoginPage />
}
