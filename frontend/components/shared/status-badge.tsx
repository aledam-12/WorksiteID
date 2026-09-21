import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, AlertTriangle, LucideIcon } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  variant?: 'active' | 'revoked' | 'pass' | 'not_pass' | 'pending' | 'error' | 'eligible' | 'not_eligible'
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const config: Record<string, { label: string; className: string; icon: LucideIcon }> = {
    ACTIVE: {
      label: 'ACTIVE',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
      icon: CheckCircle2,
    },
    REVOKED: {
      label: 'REVOKED',
      className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300',
      icon: XCircle,
    },
    PASS: {
      label: '✓ PASS',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
      icon: CheckCircle2,
    },
    NOT_PASS: {
      label: '✕ NOT PASS',
      className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300',
      icon: XCircle,
    },
    ELIGIBLE: {
      label: 'ELIGIBLE',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
      icon: CheckCircle2,
    },
    NOT_ELIGIBLE: {
      label: 'NOT ELIGIBLE',
      className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300',
      icon: XCircle,
    },
    PENDING: {
      label: 'PENDING',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
      icon: Clock,
    },
    ERROR: {
      label: 'ERROR',
      className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300',
      icon: AlertTriangle,
    },
  }

  const configKey = (variant || status).toUpperCase().replace(/[\s-]/g, '_')
  const item = config[configKey] || {
    label: status,
    className: 'bg-secondary text-secondary-foreground',
    icon: Clock,
  }

  const Icon = item.icon

  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${item.className}`}>
      <Icon className="size-3.5" />
      <span>{item.label}</span>
    </Badge>
  )
}
