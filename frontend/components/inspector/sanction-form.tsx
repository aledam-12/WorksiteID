'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, CheckCircle2, Gavel, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import type { Sanction } from '@/lib/api/types'
import Link from 'next/link'

type FormState = 'idle' | 'confirming' | 'submitting' | 'success'

export default function SanctionForm() {
  const [licenseRef, setLicenseRef] = useState('')
  const [penalty, setPenalty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<FormState>('idle')
  const [result, setResult] = useState<Sanction | null>(null)

  const validateForm = () => {
    if (!licenseRef.trim()) {
      setError('Inserisci il license reference della patente')
      return false
    }
    const penaltyNum = parseInt(penalty, 10)
    if (isNaN(penaltyNum) || penaltyNum <= 0) {
      setError('La decurtazione crediti deve essere un numero maggiore di 0')
      return false
    }
    if (!reason.trim()) {
      setError('La motivazione della sanzione è obbligatoria')
      return false
    }
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setState('confirming')
  }

  const handleConfirm = async () => {
    setState('submitting')
    setError(null)

    try {
      const penaltyNum = parseInt(penalty, 10)
      const issued = await apiClient.inspector.issueSanction(
        licenseRef.trim(),
        penaltyNum,
        reason.trim()
      )

      setResult(issued)
      setState('success')

      // Reset form
      setLicenseRef('')
      setPenalty('')
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Emissione sanzione fallita')
      setState('idle')
    }
  }

  const handleCancel = () => {
    setState('idle')
  }

  const handleNewSanction = () => {
    setResult(null)
    setState('idle')
  }

  if (state === 'success' && result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sanzione Emessa con Successo</h1>
          <p className="text-muted-foreground">La decurtazione crediti è stata registrata nel sistema</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
              Sanzione Registrata
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300">
              I crediti sono stati automaticamente scalati dallo stato della patente del lavoratore.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ID Sanzione:</span>
                <span className="font-mono font-bold">{result.sanctionId}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Crediti Decurtati:</span>
                <span className="font-bold text-destructive">-{result.penalty} crediti</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data e Ora:</span>
                <span>{result.issuedAt}</span>
              </div>

              <div className="text-sm pt-2 border-t">
                <span className="text-muted-foreground block mb-1">Motivazione:</span>
                <span className="font-medium">{result.reason}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleNewSanction} className="flex-1">
                Emetti un'Altra Sanzione
              </Button>
              <Link href="/inspector/sanctions" className="flex-1">
                <Button variant="outline" className="w-full">
                  Visualizza Registro Sanzioni
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emissione Sanzione di Cantiere</h1>
          <p className="text-muted-foreground">Registra un'infrazione e decurta crediti dalla patente del lavoratore</p>
        </div>
        <Link href="/inspector/sanctions">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="size-4" />
            Registro Sanzioni
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="size-5 text-destructive" />
            Verbale di Contestazione Infrazione
          </CardTitle>
          <CardDescription>
            Tutti i campi sono obbligatori ai sensi della normativa sulla patente a crediti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="licenseRef" className="text-sm font-medium">
                Riferimento Patente (LicenseRef) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseRef"
                placeholder="es. 4a2b... (hash pseudonimo della patente)"
                value={licenseRef}
                onChange={(e) => {
                  setLicenseRef(e.target.value)
                  setError(null)
                }}
                disabled={state !== 'idle'}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="penalty" className="text-sm font-medium">
                Punti / Crediti da Decurtare <span className="text-destructive">*</span>
              </Label>
              <Input
                id="penalty"
                type="number"
                placeholder="es. 5 (infrazione grave) o 10 (mancanza DPI anticaduta)"
                min="1"
                max="30"
                value={penalty}
                onChange={(e) => {
                  setPenalty(e.target.value)
                  setError(null)
                }}
                disabled={state !== 'idle'}
              />
              <p className="text-xs text-muted-foreground">
                Decurtazione secondo tabella allegato I-bis D.Lgs. 81/2008.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Descrizione e Motivazione Infrazione <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="es. Mancato utilizzo dei dispositivi di protezione individuale contro le cadute dall'alto..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError(null)
                }}
                disabled={state !== 'idle'}
                className="resize-none"
                rows={4}
              />
            </div>

            <Button type="submit" disabled={state !== 'idle'} className="w-full gap-2">
              <Gavel className="size-4" />
              Verifica e Conferma Sanzione
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={state === 'confirming' || state === 'submitting'}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Emissione Sanzione</DialogTitle>
            <DialogDescription>
              Attenzione: la decurtazione crediti sarà applicata immediatamente allo stato crittografico della patente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted/70 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patente:</span>
                <span className="font-mono text-xs break-all max-w-[240px]">{licenseRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Decurtazione:</span>
                <span className="font-bold text-destructive">-{penalty} crediti</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Motivazione:</span>
                <span className="font-medium">{reason}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={state === 'submitting'}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={state === 'submitting'}
              className="gap-2"
            >
              {state === 'submitting' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrazione in corso...
                </>
              ) : (
                <>
                  <Gavel className="size-4" />
                  Applica Sanzione
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
