'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, FileCode, Upload } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { VerificationResult } from '@/lib/api/types'
import Link from 'next/link'

type VerificationState = 'idle' | 'verifying' | 'success' | 'failed'

export default function VerifyCredentialPage() {
  const [state, setState] = useState<VerificationState>('idle')
  const [credentialData, setCredentialData] = useState('')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setCredentialData(content)
        setError(null)
      }
    }
    reader.onerror = () => {
      setError('Impossibile leggere il file selezionato.')
    }
    reader.readAsText(file)
  }

  const handleVerify = async () => {
    const trimmed = credentialData.trim()
    if (!trimmed) {
      setError('Incolla il JSON della credenziale o carica un file .json per avviare la verifica.')
      return
    }

    setState('verifying')
    setError(null)

    try {
      const verifyResult = await apiClient.credential.verify(trimmed)
      setResult(verifyResult)
      if (verifyResult.result === 'PASS') {
        setState('success')
      } else {
        setState('failed')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verifica crittografica non riuscita'
      setError(message)
      setState('failed')
    }
  }

  const handleReset = () => {
    setState('idle')
    setCredentialData('')
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (state === 'success' && result?.result === 'PASS') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="text-emerald-900 dark:text-emerald-100 text-xl font-bold">
              Credenziale Valida e Autentica
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300 text-xs">
              La firma digitale Ed25519 dell&apos;emettitore è autentica e la struttura W3C è conforme.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/85 p-4 border border-emerald-200 dark:border-emerald-900 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esito Verifica:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">IDONEO (PASS)</span>
              </div>

              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Ente Emettitore:</span>
                <span className="font-mono font-medium">{result.issuer || 'worksiteid-issuer'}</span>
              </div>

              {result.credentialSubject && (
                <>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">ID Lavoratore:</span>
                    <span className="font-mono font-bold">{result.credentialSubject.workerId}</span>
                  </div>

                  <div className="border-t pt-2">
                    <span className="text-muted-foreground block mb-1">Codice Riferimento Patente:</span>
                    <span className="font-mono text-xs break-all bg-muted/40 p-2 rounded block border">
                      {result.credentialSubject.licenseRef}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Data e Ora Verifica:</span>
                <span className="font-mono">{result.verifiedAt}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={handleReset} className="w-full">
                Verifica un&apos;altra credenziale
              </Button>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Torna all&apos;Accesso
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (state === 'failed' || (state === 'success' && result?.result === 'NOT_PASS')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 mb-2">
              <XCircle className="size-7" />
            </div>
            <CardTitle className="text-red-900 dark:text-red-100 text-xl font-bold">
              Credenziale Non Valida
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300 text-xs">
              La verifica della firma digitale Ed25519 o della struttura del documento ha dato esito negativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-red-950 dark:text-red-100">
            <div className="rounded-lg bg-background/85 p-4 border border-red-200 dark:border-red-900 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esito:</span>
                <span className="font-bold text-red-600 dark:text-red-400">NON VALIDA (NOT PASS)</span>
              </div>
              <div className="border-t pt-2">
                <span className="text-muted-foreground block mb-1">Motivazione:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {result?.reason || error || 'Firma digitale non valida o documento manomesso'}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={handleReset} className="w-full">
                Riprova Verifica
              </Button>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Torna all&apos;Accesso
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg border-muted">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <Link href="/login" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3 mr-1" />
              Torna al Login
            </Link>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Verifica Pubblica
            </span>
          </div>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            Verifica Credenziale Digitale W3C
          </CardTitle>
          <CardDescription className="text-xs">
            Verifica l&apos;autenticità della firma Ed25519 e l&apos;integrità della patente di cantiere rilasciata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="credential" className="text-xs font-semibold">
                Payload JSON della Credenziale
              </Label>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json,application/json"
                  className="hidden"
                  id="credential-file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-xs gap-1"
                >
                  <Upload className="size-3" />
                  Carica File .json
                </Button>
              </div>
            </div>

            <Textarea
              id="credential"
              placeholder={`{\n  "@context": ["https://www.w3.org/2018/credentials/v1"],\n  "id": "urn:uuid:...",\n  "type": ["VerifiableCredential", "WorksiteLicenseCredential"],\n  "issuer": "worksiteid-issuer",\n  "credentialSubject": { "workerId": "...", "licenseRef": "..." },\n  "proof": { ... }\n}`}
              value={credentialData}
              onChange={(e) => {
                setCredentialData(e.target.value)
                setError(null)
              }}
              className="font-mono text-xs resize-none"
              rows={9}
              disabled={state === 'verifying'}
            />
            <p className="text-[11px] text-muted-foreground">
              Puoi incollare il testo JSON oppure caricare il file esportato dalla schermata del lavoratore.
            </p>
          </div>

          <Button
            onClick={handleVerify}
            disabled={!credentialData.trim() || state === 'verifying'}
            className="w-full gap-2"
          >
            {state === 'verifying' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifica crittografica in corso...
              </>
            ) : (
              <>
                <FileCode className="size-4" />
                Verifica Credenziale
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
