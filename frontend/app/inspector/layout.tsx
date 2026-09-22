'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AppHeader from '@/components/layout/app-header'
import AppSidebar from '@/components/layout/app-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, ArrowRight, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function InspectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Caricamento sessione ispettore...</div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Frontend Route Protection: Show Unauthorized if user is not an inspector
  if (user?.userType !== 'inspector') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">Accesso Non Autorizzato</CardTitle>
            <CardDescription>
              Questa sezione è riservata esclusivamente agli Ispettori di cantiere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-xs text-muted-foreground space-y-1">
              <div>Ruolo Utente Attuale: <strong className="text-foreground">Lavoratore Edile</strong></div>
              <div>ID Utente: <span className="font-mono text-[11px]">{user?.userId}</span></div>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/worker">
                <Button className="w-full gap-2">
                  Vai alla Dashboard Lavoratore
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={async () => {
                  await logout()
                  router.push('/login')
                }}
                className="w-full gap-2 text-destructive"
              >
                <LogOut className="size-4" />
                Esci dall&apos;Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
