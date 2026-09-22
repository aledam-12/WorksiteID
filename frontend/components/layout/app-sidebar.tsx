'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Home, FileText, CheckCircle2, Gavel, ShieldCheck, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default function AppSidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const workerNav = [
    { label: 'Panoramica', href: '/worker', icon: Home },
    { label: 'Stato Patente', href: '/worker/license', icon: CreditCard },
    { label: 'Verifica Varco', href: '/worker/verify', icon: CheckCircle2 },
    { label: 'Credenziale Digitale', href: '/worker/credential', icon: ShieldCheck },
  ]

  const inspectorNav = [
    { label: 'Panoramica', href: '/inspector', icon: Home },
    { label: 'Verifica Patente', href: '/inspector/verify', icon: CheckCircle2 },
    { label: 'Emetti Sanzione', href: '/inspector/sanctions/new', icon: Gavel },
    { label: 'Registro Sanzioni', href: '/inspector/sanctions', icon: FileText },
  ]

  const navItems = user.userType === 'worker' ? workerNav : inspectorNav

  return (
    <aside className="w-60 border-r bg-card/40 flex flex-col justify-between shrink-0">
      <nav className="flex flex-col p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Menu Principale
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={`w-full justify-start gap-2.5 text-xs font-medium h-9 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold hover:bg-primary/15'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Disconnetti
        </Button>
      </div>
    </aside>
  )
}
