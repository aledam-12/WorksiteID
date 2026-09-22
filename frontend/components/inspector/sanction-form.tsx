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
      setError('Inserisci il codice di riferimento della patente')
      return false
    }
    const penaltyNum = parseInt(penalty, 10)
    if (isNaN(penaltyNum) || penaltyNum <= 0) {
      setError('La decurtazione crediti deve essere un numero positivo maggiore di 0')
      return false
    }
    if (!reason.trim()) {
      setError('La descrizione e motivazione dell’infrazione è obbligatoria')
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
      setError(err instanceof Error ? err.message : 'Emissione sanzione non riuscita')
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
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sanzione Emessa</h1>
            <p className="text-sm text-muted-foreground">La decurtazione crediti è stata applicata con successo</p>
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
              Verbale Registrato con Successo
            </CardTitle>
            <CardDescription className="text-emerald-700 dark:text-emerald-300 text-xs">
              I crediti sono stati decurtati e lo stato della patente è stato aggiornato sul registro.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-emerald-950 dark:text-emerald-100">
            <div className="rounded-lg bg-background/80 p-4 border border-emerald-200 dark:border-emerald-900 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Numero Verbale:</span>
                <span className="font-mono font-bold">{result.sanctionId}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Decurtazione Applicata:</span>
                <span className="font-bold text-destructive">-{result.penalty} crediti</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Data e Ora Registrazione:</span>
                <span className="font-mono">{result.issuedAt}</span>
              </div>

              <div className="pt-2 border-t">
                <span className="text-muted-foreground block mb-1">Motivazione Verbale:</span>
                <span className="font-medium text-foreground">{result.reason}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={handleNewSanction} className="w-full">
                Compila Altro Verbale
              </Button>
              <Link href="/inspector/sanctions" className="w-full">
                <Button variant="outline" className="w-full">
                  Registro Sanzioni
                </Button>
              </Link>
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
          <h1 className="text-2xl font-bold tracking-tight">Emissione Sanzione di Cantiere</h1>
          <p className="text-sm text-muted-foreground">Registra un&apos;infrazione e applica la decurtazione crediti</p>
        </div>
        <Link href="/inspector/sanctions">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="size-4" />
            Registro Sanzioni
          </Button>
        </Link>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Gavel className="size-5 text-destructive" />
            Verbale di Contestazione Infrazione
          </CardTitle>
          <CardDescription className="text-xs">
            I campi sono predisposti ai sensi del D.Lgs. 81/2008 in materia di sicurezza sul lavoro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="licenseRef" className="text-xs font-semibold">
                Codice Riferimento Patente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseRef"
                placeholder="es. 4a2b... (codice identificativo della patente)"
                value={licenseRef}
                onChange={(e) => {
                  setLicenseRef(e.target.value)
                  setError(null)
                }}
                disabled={state !== 'idle'}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="penalty" className="text-xs font-semibold">
                Crediti da Decurtare <span className="text-destructive">*</span>
              </Label>
              <Input
                id="penalty"
                type="number"
                placeholder="es. 5 (infrazione grave) o 10 (violazione norme anticaduta)"
                min="1"
                max="30"
                value={penalty}
                onChange={(e) => {
                  setPenalty(e.target.value)
                  setError(null)
                }}
                disabled={state !== 'idle'}
              />
              <p className="text-[11px] text-muted-foreground">
                Decurtazione secondo tabella allegato I-bis D.Lgs. 81/2008.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs font-semibold">
                Descrizione e Motivazione dell&apos;Infrazione <span className="text-destructive">*</span>
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
                className="resize-none text-xs"
                rows={4}
              />
            </div>

            <Button type="submit" disabled={state !== 'idle'} className="w-full gap-2">
              <Gavel className="size-4" />
              Verifica e Applica Sanzione
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={state === 'confirming' || state === 'submitting'}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conferma Emissione Sanzione</DialogTitle>
            <DialogDescription className="text-xs">
              La decurtazione crediti sarà applicata immediatamente allo stato della patente sul registro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted/70 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patente:</span>
                <span className="font-mono text-xs break-all max-w-[200px]">{licenseRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Decurtazione:</span>
                <span className="font-bold text-destructive">-{penalty} crediti</span>
              </div>
              <div className="border-t pt-2">
                <span className="text-muted-foreground block mb-1">Motivazione:</span>
                <span className="font-medium text-foreground">{reason}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={state === 'submitting'}
              className="text-xs"
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={state === 'submitting'}
              className="gap-2 text-xs"
            >
              {state === 'submitting' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Registrazione in corso...
                </>
              ) : (
                <>
                  <Gavel className="size-3.5" />
                  Conferma Sanzione
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
