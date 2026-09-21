'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { VerificationResult as VerificationResultType } from '@/lib/api/types'

type VerificationState = 'idle' | 'verifying' | 'success' | 'failed'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function WorkerVerifyPage() {
  const [state, setState] = useState<VerificationState>('idle')
  const [result, setResult] = useState<VerificationResultType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('Preparing verification...')

  const handleStartVerification = async () => {
    setState('verifying')
    setError(null)

    try {
      // Step 1: Preparing verification...
      setCurrentStep('Preparing verification...')
      const challenge = await apiClient.worker.getVerificationChallenge()
      await delay(400)

      // Step 2: Generating proof...
      setCurrentStep('Generating proof...')
      await delay(450)

      // Step 3: Verifying proof...
      setCurrentStep('Verifying proof...')
      await delay(400)

      // Step 4: Checking license state...
      setCurrentStep('Checking license state...')
      const verifyResult = await apiClient.worker.submitVerification(challenge.challengeId)
      await delay(350)

      setResult(verifyResult)
      if (verifyResult.result === 'PASS') {
        setState('success')
      } else {
        setState('failed')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      setError(message)
      setState('failed')
    }
  }

  const handleTryAgain = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setCurrentStep('Preparing verification...')
  }

  if (state === 'success' && result?.result === 'PASS') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifica Accesso Gate</h1>
          <p className="text-muted-foreground">Verifica crittografica dell&apos;idoneità della patente al varco di cantiere</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
              PASS — Accesso Cantiere Autorizzato
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300">
              La prova Zero-Knowledge è stata verificata con successo. La patente soddisfa i requisiti minimi di legge (stato attivo e soglia minima crediti).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Esito Verifica:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">PASS</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Orario Verifica:</span>
                <span className="font-mono">{result.verifiedAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Privacy ZKP:</span>
                <span className="font-medium text-xs">Saldo crediti esatto e dati privati protetti</span>
              </div>
            </div>

            <Button onClick={handleTryAgain} className="w-full">
              Nuova Verifica
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
          <h1 className="text-3xl font-bold tracking-tight">Verifica Accesso Gate</h1>
          <p className="text-muted-foreground">Verifica crittografica dell&apos;idoneità della patente al varco di cantiere</p>
        </div>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <XCircle className="size-6 text-red-600 dark:text-red-400" />
              NOT_PASS — Accesso Interdetto
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              La verifica non ha superato i controlli di conformità per l&apos;ingresso in cantiere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-red-950 dark:text-red-100">
            <div className="rounded-lg bg-background/80 p-4 border border-red-200 dark:border-red-900 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Esito:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">NOT_PASS</span>
              </div>
              {result?.reason && (
                <div className="text-sm">
                  <span className="text-muted-foreground block mb-1">Motivazione:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{result.reason}</span>
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

  if (state === 'verifying') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifica Accesso Gate</h1>
          <p className="text-muted-foreground">Esecuzione del protocollo di verifica in corso...</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Elaborazione Protocollo Crittografico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="flex items-center justify-center">
              <Loader2 className="size-10 animate-spin text-primary" />
            </div>
            <div className="text-center text-sm font-semibold tracking-wide text-foreground">
              {currentStep}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Verifica della challenge anti-replay e controllo dello stato autorizzativo della patente
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verifica Accesso Gate</h1>
        <p className="text-muted-foreground">
          Dimostra la conformità della tua patente (saldo ≥ 15 crediti e stato ATTIVO) senza svelare il punteggio effettivo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Ready to verify
          </CardTitle>
          <CardDescription>
            Il sistema genera un challenge temporaneo monouso (`nonce`) verificato sul ledger/persistence layer per autorizzare l&apos;accesso in Zero-Knowledge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground space-y-1">
            <p>1. Richiesta della challenge crittografica anti-replay.</p>
            <p>2. Generazione e verifica della prova Zero-Knowledge.</p>
            <p>3. Controllo autorizzativo dello stato della patente.</p>
          </div>

          <Button onClick={handleStartVerification} size="lg" className="w-full">
            Start Verification
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
