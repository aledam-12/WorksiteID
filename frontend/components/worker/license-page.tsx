'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { apiClient } from '@/lib/api/client'
import type { License } from '@/lib/api/types'
import { AlertCircle, Copy, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function WorkerLicensePage() {
  const [license, setLicense] = useState<License | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        const data = await apiClient.worker.getLicense()
        setLicense(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load license')
      } finally {
        setLoading(false)
      }
    }

    fetchLicense()
  }, [])

  const copyLicenseRef = () => {
    if (license?.licenseRef) {
      navigator.clipboard.writeText(license.licenseRef)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!license) return <ErrorState message="License not found" />

  const isNotEligible = license.verificationEligibility === 'NOT_ELIGIBLE'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dettaglio Patente a Crediti</h1>
        <p className="text-muted-foreground">Stato di conformità e identificativo crittografico di cantiere</p>
      </div>

      {isNotEligible && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Attenzione: Accesso al Cantiere Interdetto</AlertTitle>
          <AlertDescription>
            La tua patente non possiede i requisiti minimi di idoneità ({license.status === 'REVOKED' ? 'Patente Revocata' : 'Crediti insufficienti, inferiori a 15'}).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Informazioni Stato e Sicurezza
          </CardTitle>
          <CardDescription>
            I dati sono verificati in tempo reale tramite lo smart service crittografico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Stato Patente</div>
              <StatusBadge status={license.status} />
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Idoneità di Verifica</div>
              <StatusBadge status={license.verificationEligibility} />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-muted-foreground">Riferimento Patente (LicenseRef)</span>
              <Button variant="ghost" size="sm" onClick={copyLicenseRef} className="h-7 text-xs gap-1">
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copied ? 'Copiato' : 'Copia'}
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-md font-mono text-xs break-all select-all">
              {license.licenseRef}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Digest pseudonimo HMAC-SHA256: tutela la privacy del lavoratore sul cantiere.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Versione Stato Patente</div>
              <div className="text-xl font-bold">v{license.version}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Ultimo Aggiornamento Verificato</div>
              <div className="text-sm font-medium pt-1">{license.lastUpdated}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
