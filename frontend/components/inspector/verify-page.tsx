'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, Search, ShieldCheck, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { VerificationResult as VerificationResultType } from '@/lib/api/types'
import { StatusBadge } from '@/components/shared/status-badge'
import Link from 'next/link'

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
      setError('Inserisci il codice di riferimento della patente da verificare.')
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
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
            <p className="text-sm text-muted-foreground">Controllo di conformità in cantiere</p>
          </div>
          <Link href="/inspector">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="size-4" />
              Panoramica
            </Button>
          </Link>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="text-emerald-900 dark:text-emerald-100 text-xl font-bold">
              Patente Conforme e Idonea (PASS)
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300 text-xs">
              La patente risulta attiva e in regola per operare nel cantiere.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">Codice Riferimento Patente:</span>
                <span className="font-mono break-all p-2 bg-muted/40 rounded block">{licenseRef}</span>
              </div>

              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Stato Patente:</span>
                <StatusBadge status={result.status || 'ACTIVE'} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Orario Ispezione:</span>
                <span className="font-mono">{result.verifiedAt}</span>
              </div>
            </div>

            <Button onClick={handleTryAgain} className="w-full">
              Verifica un&apos;altra patente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'failed' || (state === 'success' && result?.result === 'NOT_PASS')) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
            <p className="text-sm text-muted-foreground">Controllo di conformità in cantiere</p>
          </div>
          <Link href="/inspector">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="size-4" />
              Panoramica
            </Button>
          </Link>
        </div>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 mb-2">
              <XCircle className="size-7" />
            </div>
            <CardTitle className="text-red-900 dark:text-red-100 text-xl font-bold">
              Patente Non Conforme (NOT PASS)
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300 text-xs">
              La patente non soddisfa i requisiti normativi per l&apos;attività in cantiere.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-red-950 dark:text-red-100">
            <div className="rounded-lg bg-background/80 p-4 border border-red-200 dark:border-red-900 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">Codice Riferimento Patente:</span>
                <span className="font-mono break-all p-2 bg-muted/40 rounded block">{licenseRef}</span>
              </div>

              {result?.reason && (
                <div className="border-t pt-2">
                  <span className="text-muted-foreground block mb-1">Motivazione Irregolarità:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{result.reason}</span>
                </div>
              )}

              {result?.status && (
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-muted-foreground">Stato Rilevato:</span>
                  <StatusBadge status={result.status} />
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verifica Patente Lavoratore</h1>
          <p className="text-sm text-muted-foreground">
            Controllo dello stato di validità e idoneità tramite codice identificativo
          </p>
        </div>
        <Link href="/inspector">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="size-4" />
            Panoramica
          </Button>
        </Link>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Inserisci Codice Patente
          </CardTitle>
          <CardDescription className="text-xs">
            L&apos;ispettore verifica la conformità della patente tutelando i dati non pertinenti del lavoratore.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="licenseRef" className="text-xs font-semibold">
                Codice Riferimento Patente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseRef"
                placeholder="es. 4a2b... (codice fornito dal lavoratore o presente sul badge)"
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
                  Esegui Verifica Patente
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
