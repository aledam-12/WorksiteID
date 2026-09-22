'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { VerificationResult as VerificationResultType } from '@/lib/api/types'
import Link from 'next/link'

type VerificationState = 'idle' | 'verifying' | 'success' | 'failed'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function WorkerVerifyPage() {
  const [state, setState] = useState<VerificationState>('idle')
  const [result, setResult] = useState<VerificationResultType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('Preparazione della verifica...')

  const handleStartVerification = async () => {
    setState('verifying')
    setError(null)

    try {
      // Step 1: Preparazione
      setCurrentStep('Richiesta della sfida di sicurezza...')
      const challenge = await apiClient.worker.getVerificationChallenge()
      await delay(400)

      // Step 2: Calcolo prova ZKP
      setCurrentStep('Generazione della prova a conoscenza zero...')
      await delay(450)

      // Step 3: Verifica crittografica
      setCurrentStep('Verifica matematica al varco...')
      await delay(400)

      // Step 4: Controllo stato
      setCurrentStep('Verifica conformità patente...')
      const verifyResult = await apiClient.worker.submitVerification(challenge.challengeId)
      await delay(350)

      setResult(verifyResult)
      if (verifyResult.result === 'PASS') {
        setState('success')
      } else {
        setState('failed')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verifica non riuscita'
      setError(message)
      setState('failed')
    }
  }

  const handleTryAgain = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setCurrentStep('Preparazione della verifica...')
  }

  if (state === 'success' && result?.result === 'PASS') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Verifica Ingresso Varco</h1>
            <p className="text-sm text-muted-foreground">Controllo crittografico dell&apos;idoneità della patente</p>
          </div>
          <Link href="/worker">
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
              Accesso Autorizzato (PASS)
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300 text-xs">
              La prova è stata validata con successo. La patente soddisfa tutti i requisiti minimi di cantiere.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esito Verifica:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">IDONEO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orario Validazione:</span>
                <span className="font-mono">{result.verifiedAt}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Protezione Riservatezza:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saldo crediti protetto da Zero-Knowledge</span>
              </div>
            </div>

            <Button onClick={handleTryAgain} className="w-full">
              Esegui Nuova Verifica
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
            <h1 className="text-2xl font-bold tracking-tight">Verifica Ingresso Varco</h1>
            <p className="text-sm text-muted-foreground">Controllo crittografico dell&apos;idoneità della patente</p>
          </div>
          <Link href="/worker">
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
              Accesso Non Autorizzato (NOT PASS)
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300 text-xs">
              I requisiti minimi di conformità per l&apos;ingresso in cantiere non risultano soddisfatti.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-red-950 dark:text-red-100">
            <div className="rounded-lg bg-background/80 p-4 border border-red-200 dark:border-red-900 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esito:</span>
                <span className="font-bold text-red-600 dark:text-red-400">NON IDONEO</span>
              </div>
              {result?.reason && (
                <div className="border-t pt-2">
                  <span className="text-muted-foreground block mb-1">Motivazione:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{result.reason}</span>
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

  if (state === 'verifying') {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Verifica Ingresso Varco</h1>
          <p className="text-sm text-muted-foreground">Protocollo di sicurezza in esecuzione...</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="space-y-6 py-10">
            <div className="flex items-center justify-center">
              <Loader2 className="size-12 animate-spin text-primary" />
            </div>
            <div className="text-center space-y-1">
              <div className="text-sm font-semibold text-foreground">
                {currentStep}
              </div>
              <p className="text-xs text-muted-foreground">
                Verifica della sfida temporanea e controllo dello stato autorizzativo della patente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verifica Ingresso Varco</h1>
          <p className="text-sm text-muted-foreground">
            Dimostra la conformità della tua patente (saldo ≥ 15 crediti e stato attivo) senza svelare il punteggio effettivo
          </p>
        </div>
        <Link href="/worker">
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
            Controllo di Accesso al Cantiere
          </CardTitle>
          <CardDescription className="text-xs">
            Il sistema genera una sfida temporanea monouso e valida i requisiti di legge in totale riservatezza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="p-4 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground mb-1">Fasi del controllo:</div>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">1</span>
              <span>Generazione della sfida di sicurezza monouso</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">2</span>
              <span>Calcolo e verifica della prova crittografica Zero-Knowledge</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">3</span>
              <span>Convalida dello stato di conformità per l&apos;ingresso</span>
            </div>
          </div>

          <Button onClick={handleStartVerification} size="lg" className="w-full gap-2">
            <CheckCircle2 className="size-4" />
            Avvia Verifica Accesso
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
