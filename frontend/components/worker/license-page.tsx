'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { apiClient } from '@/lib/api/client'
import type { License } from '@/lib/api/types'
import { AlertCircle, Copy, Check, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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
        setError(err instanceof Error ? err.message : 'Impossibile caricare i dati della patente')
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
  if (!license) return <ErrorState message="Dati della patente non trovati" />

  const isNotEligible = license.verificationEligibility === 'NOT_ELIGIBLE'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dettaglio Patente a Crediti</h1>
          <p className="text-sm text-muted-foreground">Stato di conformità e codice identificativo di cantiere</p>
        </div>
        <Link href="/worker">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="size-4" />
            Torna alla Panoramica
          </Button>
        </Link>
      </div>

      {isNotEligible && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Attenzione: Accesso al Cantiere Interdetto</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            La patente non soddisfa i requisiti minimi di idoneità ({license.status === 'REVOKED' ? 'Patente Revocata' : 'Crediti insufficienti, inferiori alla soglia minima di 15'}).
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Informazioni e Stato di Conformità
          </CardTitle>
          <CardDescription className="text-xs">
            Dati sincronizzati con il registro di sicurezza e verificati crittograficamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="p-4 bg-muted/40 rounded-lg space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Stato Patente</span>
              <div>
                <StatusBadge status={license.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {license.status === 'ACTIVE'
                  ? 'Patente attiva e valida per le attività di cantiere.'
                  : 'Patente revocata a seguito di provvedimento disciplinare.'}
              </p>
            </div>

            <div className="p-4 bg-muted/40 rounded-lg space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Idoneità Varco</span>
              <div>
                <StatusBadge status={license.verificationEligibility} />
              </div>
              <p className="text-xs text-muted-foreground">
                {license.verificationEligibility === 'ELIGIBLE'
                  ? 'Soglia minima di crediti (≥ 15) verificata in sicurezza.'
                  : 'Punteggio inferiore al minimo di legge per operare.'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Codice Riferimento Patente</span>
              <Button variant="ghost" size="sm" onClick={copyLicenseRef} className="h-7 text-xs gap-1.5">
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copied ? 'Copiato!' : 'Copia Codice'}
              </Button>
            </div>
            <div className="p-3 bg-muted/70 rounded-md font-mono text-xs break-all select-all border">
              {license.licenseRef}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Codice identificativo di sicurezza: consente le verifiche ispettive tutelando la privacy dei dati personali.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground">Versione di Stato</span>
              <div className="text-base font-bold">v{license.version}</div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Ultimo Aggiornamento</span>
              <div className="text-sm font-medium font-mono">{license.lastUpdated}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
