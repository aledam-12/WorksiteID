'use client'

import { useAuth } from '@/lib/auth-context'
import { ShieldCheck, HardHat, Eye } from 'lucide-react'

export default function AppHeader() {
  const { user } = useAuth()

  if (!user) return null

  const isWorker = user.userType === 'worker'
  const roleLabel = isWorker ? 'Lavoratore Edile' : 'Ispettore di Vigilanza'

  return (
    <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight">WorksiteID</div>
            <div className="text-[11px] text-muted-foreground">Piattaforma Patente a Crediti</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold leading-tight">
              {user.name} {user.surname}
            </div>
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground mt-0.5">
              {isWorker ? (
                <HardHat className="size-3 text-amber-500" />
              ) : (
                <Eye className="size-3 text-blue-500" />
              )}
              <span>{roleLabel}</span>
            </div>
          </div>

          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
            {user.name?.[0]?.toUpperCase()}{user.surname?.[0]?.toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  )
}
