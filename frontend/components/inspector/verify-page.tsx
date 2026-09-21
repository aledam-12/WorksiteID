'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, Search, ShieldCheck } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { VerificationResult as VerificationResultType } from '@/lib/api/types'
import { StatusBadge } from '@/components/shared/status-badge'

type VerificationState = 'idle' | 'verifying' | 'success' | 'failed'

export default function InspectorVerifyPage() {
  const [licenseRef, setLicenseRef] = useState('')
  const [state, setState] = useState<VerificationState>('idle')
  const [result, setResult] = useState<VerificationResultType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedRef = licenseRef.trim()
    if (!trimmedRef) {
      setError('Inserisci il license reference della patente da verificare')
      return
    }

    setState('verifying')
    setError(null)

    try {
      const verifyResult = await apiClient.inspector.verifyLicense(trimmedRef)
      setResult(verifyResult)
      if (verifyResult.result === 'PASS') {
        setState('success')
      } else {
        setState('failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifica non riuscita')
      setState('failed')
    }
  }

  const handleTryAgain = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setLicenseRef('')
  }

  if (state === 'success' && result?.result === 'PASS') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
          <p className="text-muted-foreground">Controllo di conformità in cantiere</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
              Patente Conforme e Idonea (PASS)
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300">
              La patente risulta attiva e con crediti sufficienti per operare in cantiere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Riferimento Patente (LicenseRef)</div>
                <div className="text-xs font-mono break-all p-2 bg-muted/40 rounded">{licenseRef}</div>
              </div>

              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Stato Patente:</span>
                <StatusBadge status={result.status || 'ACTIVE'} />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Orario Verifica Ispettore:</span>
                <span className="font-mono text-xs">{result.verifiedAt}</span>
              </div>
            </div>

            <Button onClick={handleTryAgain} className="w-full">
              Verifica un'Altra Patente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'failed' || (state === 'success' && result?.result === 'NOT_PASS')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
          <p className="text-muted-foreground">Controllo di conformità in cantiere</p>
        </div>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <XCircle className="size-6 text-red-600 dark:text-red-400" />
              Patente Non Conforme (NOT PASS)
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              La patente non soddisfa i requisiti minimi per operare nel cantiere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-red-950 dark:text-red-100">
            <div className="rounded-lg bg-background/80 p-4 border border-red-200 dark:border-red-900 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Riferimento Patente Verificato</div>
                <div className="text-xs font-mono break-all p-2 bg-muted/40 rounded">{licenseRef}</div>
              </div>

              {result?.reason && (
                <div className="text-sm">
                  <span className="text-muted-foreground block mb-1">Motivazione Irregolarità:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{result.reason}</span>
                </div>
              )}

              {result?.status && (
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Stato Rilevato:</span>
                  <StatusBadge status={result.status} />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button onClick={handleTryAgain} className="w-full">
              Riprova Verifica
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
        <p className="text-muted-foreground">Controllo crittografico dello stato della patente tramite identificativo pseudonimo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Inserisci Riferimento Patente (LicenseRef)
          </CardTitle>
          <CardDescription>
            L'ispettore verifica la validità e l'idoneità operativa senza violare la riservatezza anagrafica non pertinente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="licenseRef" className="text-sm font-medium">
                License Reference (HMAC hex) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseRef"
                placeholder="es. 4a2b... (puoi copiare il riferimento dalla dashboard lavoratore)"
                value={licenseRef}
                onChange={(e) => {
                  setLicenseRef(e.target.value)
                  setError(null)
                }}
                disabled={state === 'verifying'}
                className="font-mono text-xs"
              />
            </div>

            <Button type="submit" disabled={state === 'verifying'} className="w-full gap-2">
              {state === 'verifying' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verifica in corso...
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Verifica Patente
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
