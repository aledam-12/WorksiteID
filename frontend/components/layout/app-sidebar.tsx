'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Home, FileText, CheckCircle2, Gavel, Lock } from 'lucide-react'
import Link from 'next/link'

export default function AppSidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const workerNav = [
    { label: 'Dashboard', href: '/worker', icon: Home },
    { label: 'License', href: '/worker/license', icon: FileText },
    { label: 'Verify License', href: '/worker/verify', icon: CheckCircle2 },
    { label: 'Credential', href: '/worker/credential', icon: Lock },
  ]

  const inspectorNav = [
    { label: 'Dashboard', href: '/inspector', icon: Home },
    { label: 'Verify License', href: '/inspector/verify', icon: CheckCircle2 },
    { label: 'Issue Sanction', href: '/inspector/sanctions/new', icon: Gavel },
    { label: 'Sanctions', href: '/inspector/sanctions', icon: FileText },
  ]

  const navItems = user.userType === 'worker' ? workerNav : inspectorNav

  return (
    <aside className="w-64 border-r bg-background">
      <nav className="flex flex-col p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="justify-start w-full mb-2"
              >
                <Icon className="mr-2 size-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}

        <div className="mt-auto pt-4 border-t">
          <Button
            variant="ghost"
            className="justify-start w-full text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 size-4" />
            Logout
          </Button>
        </div>
      </nav>
    </aside>
  )
}
