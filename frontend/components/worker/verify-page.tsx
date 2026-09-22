'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Server,
  Smartphone,
  Shield,
  KeyRound,
  FileCode,
  RefreshCw,
  Play,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type {
  VerificationChallenge,
  ZkpProofResponse,
  VerificationResult as VerificationResultType,
} from '@/lib/api/types'
import Link from 'next/link'

type FlowStep = 0 | 1 | 2 | 3 | 4 | 5

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function WorkerVerifyPage() {
  const [currentStep, setCurrentStep] = useState<FlowStep>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [stepDescription, setStepDescription] = useState<string>('')

  // Dati delle diverse fasi
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null)
  const [proofData, setProofData] = useState<ZkpProofResponse | null>(null)
  const [result, setResult] = useState<VerificationResultType | null>(null)
  const [copied, setCopied] = useState(false)

  // Copia negli appunti della stringa della prova
  const handleCopyProofString = () => {
    if (!proofData?.proofString) return
    navigator.clipboard.writeText(proofData.proofString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Ripristina l'intero flusso
  const handleReset = () => {
    setCurrentStep(0)
    setIsLoading(false)
    setChallenge(null)
    setProofData(null)
    setResult(null)
    setStepDescription('')
  }

  // Gestione esito negativo (crediti insufficienti o patente non valida)
  const handleDenial = (reasonText: string) => {
    setResult({
      result: 'NOT_PASS',
      verifiedAt: new Date().toLocaleString('it-IT'),
      reason: reasonText,
      checks: {
        antiReplay: true,
        mathGroth16: false,
        onChainCommitment: false,
        complianceActive: false,
        creditsProtected: true,
      },
    })
    setCurrentStep(5)
    setIsLoading(false)
    setStepDescription('Accesso Negato: Requisiti minimi di cantiere non soddisfatti')
  }

  // Flusso automatico sequenziale
  const handleStartVerification = async () => {
    handleReset()
    setIsLoading(true)

    try {
      // FASE 1: Richiesta sfida di sicurezza monouso al varco
      setCurrentStep(1)
      setStepDescription('Fase 1/4: Richiesta della sfida di sicurezza monouso al Gateway del varco...')
      await delay(450)
      const ch = await apiClient.worker.getVerificationChallenge()
      setChallenge(ch)
      await delay(500)

      // FASE 2: Richiesta generazione prova ZKP al backend
      setCurrentStep(2)
      setStepDescription('Fase 2/4: Elaborazione della prova a conoscenza zero sul Backend...')
      await delay(600)

      const pData = await apiClient.worker.generateZkpProof(ch.challengeId)
      setProofData(pData)

      // Se il lavoratore non soddisfa i requisiti minimi (es. crediti < 15 o patente non attiva)
      if (pData.eligible === false || !pData.proofString) {
        const reason = pData.reason || 'Crediti insufficienti (< 15) o patente revocata: requisiti minimi di legge non soddisfatti.'
        handleDenial(reason)
        return
      }

      // FASE 3: Ricezione stringa della prova nel client
      setCurrentStep(3)
      setStepDescription('Fase 3/4: Ricezione della stringa crittografica della prova nel tuo dispositivo.')
      // Breve pausa per visualizzare la stringa ricevuta prima dell'invio al varco
      await delay(1200)

      // FASE 4: Invio della stringa al Gateway e convalida al varco
      setCurrentStep(4)
      setStepDescription('Fase 4/4: Trasmissione della stringa al Gateway del varco e verifica di conformità...')
      await delay(700)

      const verifyResult = await apiClient.worker.submitVerification(
        ch.challengeId,
        pData.proof,
        pData.publicSignals,
        pData.proofString
      )

      setResult(verifyResult)
      setCurrentStep(5)
      setIsLoading(false)
      setStepDescription(
        verifyResult.result === 'PASS'
          ? 'Accesso Autorizzato: Patente idonea per l\'ingresso'
          : 'Accesso Negato: Requisiti di sicurezza non soddisfatti'
      )
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err)
      const isCircError =
        rawMsg.includes('Assert Failed') ||
        rawMsg.includes('template') ||
        rawMsg.includes('credits') ||
        rawMsg.includes('422')

      const cleanReason = isCircError
        ? 'Crediti insufficienti (< 15) o patente non attiva: la prova crittografica non può essere generata.'
        : rawMsg

      handleDenial(cleanReason)
    }
  }

  const isDeniedAtStep2 = result?.result === 'NOT_PASS' && (!proofData || proofData.eligible === false)

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Verifica Ingresso Varco</h1>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Zero-Knowledge
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verifica dell&apos;idoneità della patente senza svelare il punteggio residuo dei crediti
          </p>
        </div>
        <Link href="/worker">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="size-4" />
            Panoramica
          </Button>
        </Link>
      </div>

      {/* Attori del flusso */}
      <Card className="bg-muted/30 border-dashed shadow-none">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`p-2.5 rounded-lg border transition-all ${
              currentStep === 0 || currentStep === 3
                ? 'bg-primary/10 border-primary font-semibold text-primary'
                : 'bg-background/80 border-border text-muted-foreground'
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Smartphone className="size-3.5" />
                <span>1. Dispositivo (Client)</span>
              </div>
              <p className="text-[10px] opacity-80">Riceve e custodisce la prova</p>
            </div>

            <div className={`p-2.5 rounded-lg border transition-all ${
              currentStep === 2
                ? 'bg-primary/10 border-primary font-semibold text-primary'
                : isDeniedAtStep2
                  ? 'bg-destructive/10 border-destructive font-semibold text-destructive'
                  : 'bg-background/80 border-border text-muted-foreground'
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Server className="size-3.5" />
                <span>2. Backend di Sicurezza</span>
              </div>
              <p className="text-[10px] opacity-80">Genera la prova a conoscenza zero</p>
            </div>

            <div className={`p-2.5 rounded-lg border transition-all ${
              currentStep === 1 || currentStep === 4 || currentStep === 5
                ? result?.result === 'PASS'
                  ? 'bg-emerald-500/15 border-emerald-500 font-semibold text-emerald-700 dark:text-emerald-300'
                  : result?.result === 'NOT_PASS'
                    ? 'bg-destructive/10 border-destructive font-semibold text-destructive'
                    : 'bg-primary/10 border-primary font-semibold text-primary'
                : 'bg-background/80 border-border text-muted-foreground'
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Shield className="size-3.5" />
                <span>3. Gateway Varco</span>
              </div>
              <p className="text-[10px] opacity-80">Convalida la prova e sblocca l&apos;accesso</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card iniziale di avvio */}
      {currentStep === 0 && (
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Controllo di Accesso al Cantiere
            </CardTitle>
            <CardDescription className="text-xs">
              Il controllo verifica automaticamente che la tua patente sia attiva e abbia almeno 15 crediti, proteggendo la tua privacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-2">
              <div className="font-semibold text-foreground">Fasi del controllo di accesso:</div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1">
                <li><strong className="text-foreground">Sfida Varco:</strong> il gateway genera un codice monouso di sicurezza.</li>
                <li><strong className="text-foreground">Generazione Prova:</strong> il backend calcola la prova matematica di conformità.</li>
                <li><strong className="text-foreground">Ricezione Stringa:</strong> il tuo dispositivo riceve la stringa crittografica protetta.</li>
                <li><strong className="text-foreground">Convalida Varco:</strong> il gateway verifica la stringa e autorizza l&apos;ingresso.</li>
              </ol>
            </div>

            <Button
              onClick={handleStartVerification}
              className="w-full gap-2 text-sm font-semibold"
              size="lg"
            >
              <Play className="size-4" />
              Avvia Verifica Accesso
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Barra di avanzamento delle 4 fasi */}
      {currentStep > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className={`p-2 rounded-md border transition-all ${
            currentStep >= 1 ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground opacity-50'
          }`}>
            <span className="block font-bold">1. Sfida Varco</span>
            <span className="text-[10px]">{currentStep > 1 ? '✓ Generata' : currentStep === 1 ? 'In corso...' : 'In attesa'}</span>
          </div>

          <div className={`p-2 rounded-md border transition-all ${
            isDeniedAtStep2
              ? 'border-destructive bg-destructive/10 text-destructive font-medium'
              : currentStep >= 2
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground opacity-50'
          }`}>
            <span className="block font-bold">2. Prova ZKP</span>
            <span className="text-[10px]">
              {isDeniedAtStep2
                ? '✕ Respinta'
                : currentStep > 2
                  ? '✓ Elaborata'
                  : currentStep === 2
                    ? 'In corso...'
                    : 'In attesa'}
            </span>
          </div>

          <div className={`p-2 rounded-md border transition-all ${
            isDeniedAtStep2
              ? 'border-border text-muted-foreground opacity-40'
              : currentStep >= 3
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground opacity-50'
          }`}>
            <span className="block font-bold">3. Stringa Prova</span>
            <span className="text-[10px]">
              {isDeniedAtStep2
                ? '— Non emessa'
                : currentStep > 3
                  ? '✓ Pronta'
                  : currentStep === 3
                    ? 'Ricevuta'
                    : 'In attesa'}
            </span>
          </div>

          <div className={`p-2 rounded-md border transition-all ${
            result?.result === 'NOT_PASS'
              ? 'border-destructive bg-destructive/10 text-destructive font-medium'
              : currentStep === 5 && result?.result === 'PASS'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-medium'
                : currentStep >= 4
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground opacity-50'
          }`}>
            <span className="block font-bold">4. Verifica Varco</span>
            <span className="text-[10px]">
              {result?.result === 'NOT_PASS'
                ? '✕ Negato'
                : result?.result === 'PASS'
                  ? '✓ Concesso'
                  : currentStep === 4
                    ? 'In corso...'
                    : 'In attesa'}
            </span>
          </div>
        </div>
      )}

      {/* Alert informativo sullo stato corrente */}
      {isLoading && (
        <Alert className="border-primary/40 bg-primary/5">
          <Loader2 className="size-4 animate-spin text-primary" />
          <AlertDescription className="text-xs text-foreground font-medium">
            {stepDescription}
          </AlertDescription>
        </Alert>
      )}

      {/* Fase 1: Sfida del Varco generata */}
      {challenge && (
        <Card className="shadow-xs">
          <CardHeader className="py-2.5 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Fase 1: Sfida di Sicurezza Ricevuta
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
              Codice Monouso
            </Badge>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="bg-background rounded-md p-2 border">
                <span className="text-muted-foreground block text-[10px]">Codice Sessione Sfida:</span>
                <span className="font-mono text-xs font-medium text-foreground select-all break-all">
                  {challenge.challengeId}
                </span>
              </div>
              <div className="bg-background rounded-md p-2 border">
                <span className="text-muted-foreground block text-[10px]">Codice Nonce di Sicurezza:</span>
                <span className="font-mono text-xs font-medium text-foreground select-all break-all">
                  {challenge.nonce ? `${challenge.nonce.slice(0, 28)}...` : 'Attivo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caso A: Fase 2 Respinta (Requisiti non soddisfatti) */}
      {isDeniedAtStep2 && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-xs">
          <CardHeader className="py-2.5 px-4 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-destructive" />
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-destructive">
                Fase 2: Generazione Prova Respinta
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-[10px]">
              Non Idoneo
            </Badge>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2 text-xs">
            <div className="rounded-md bg-background p-3 border space-y-1">
              <span className="font-semibold text-destructive block">
                Motivo del Blocco:
              </span>
              <p className="text-foreground text-xs leading-relaxed">
                {proofData?.reason || result?.reason}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Il sistema verifica che la patente sia attiva e abbia almeno 15 crediti. Poiché questi requisiti minimi non sono soddisfatti, la prova di accesso non può essere rilasciata.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Caso B: Fase 3 Stringa della Prova Ricevuta nel Client */}
      {proofData && proofData.eligible !== false && proofData.proofString && (
        <Card className="border-primary/40 bg-card shadow-sm overflow-hidden">
          <CardHeader className="py-2.5 px-4 bg-primary/10 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="size-4 text-primary" />
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
                Fase 3: Stringa della Prova ZKP Ricevuta
              </CardTitle>
            </div>
            <Badge className="text-[10px] bg-primary text-primary-foreground">
              Prova Crittografica
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Stringa della Prova (trasmessa al Gateway del varco):
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyProofString}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  {copied ? 'Copiato' : 'Copia'}
                </Button>
              </div>

              {/* Riquadro della stringa della prova */}
              <div className="p-2.5 bg-muted/60 rounded-lg border font-mono text-[11px] text-foreground break-all leading-relaxed max-h-24 overflow-y-auto select-all">
                {proofData.proofString}
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-md border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-[11px]">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Riservatezza Garantita:</strong> la stringa dimostra che hai crediti a sufficienza (≥ 15) senza svelare il tuo punteggio effettivo.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fase 5: Esito Finale di Accesso (PASS / NOT_PASS) */}
      {result && (
        <Card className={`border shadow-md ${
          result.result === 'PASS'
            ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40'
            : 'border-destructive/40 bg-destructive/5'
        }`}>
          <CardHeader className="text-center pb-3">
            <div className={`mx-auto flex size-12 items-center justify-center rounded-full mb-2 ${
              result.result === 'PASS'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {result.result === 'PASS' ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
            </div>
            <CardTitle className={`text-lg font-bold ${
              result.result === 'PASS'
                ? 'text-emerald-900 dark:text-emerald-100'
                : 'text-destructive'
            }`}>
              {result.result === 'PASS' ? 'Accesso Autorizzato al Varco' : 'Accesso Negato al Varco'}
            </CardTitle>
            <CardDescription className="text-xs">
              {result.result === 'PASS'
                ? 'La prova è stata convalidata con successo dal Gateway. La patente rispetta tutti i requisiti di cantiere.'
                : 'I requisiti minimi di sicurezza non risultano soddisfatti. L\'ingresso in cantiere non è consentito.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-background/90 p-3.5 border space-y-2 text-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground font-medium">Esito del Controllo:</span>
                <Badge variant={result.result === 'PASS' ? 'default' : 'destructive'} className="font-bold">
                  {result.result === 'PASS' ? 'IDONEO (PASS)' : 'NON IDONEO (NOT PASS)'}
                </Badge>
              </div>

              {result.reason && (
                <div className="flex justify-between items-start pt-1">
                  <span className="text-muted-foreground shrink-0 w-28">Motivazione:</span>
                  <span className="font-semibold text-destructive text-right">
                    {result.reason}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Orario Verifica:</span>
                <span className="font-mono text-foreground">{result.verifiedAt}</span>
              </div>

              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-muted-foreground">Protezione Dati Personali:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Zero-Knowledge (Punteggio crediti protetto)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleReset} variant="outline" className="flex-1 gap-2 text-xs">
                <RefreshCw className="size-3.5" />
                Nuova Verifica
              </Button>
              <Link href="/worker" className="flex-1">
                <Button className="w-full gap-2 text-xs">
                  <ArrowLeft className="size-3.5" />
                  Torna alla Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
