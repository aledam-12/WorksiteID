'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { apiClient } from '@/lib/api/client'
import type { Credential } from '@/lib/api/types'
import { Copy, Check, ShieldCheck, FileCode, ExternalLink, ArrowLeft, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export default function WorkerCredentialPage() {
  const [credential, setCredential] = useState<Credential | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  useEffect(() => {
    const fetchCredential = async () => {
      try {
        const data = await apiClient.worker.getCredential()
        setCredential(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossibile caricare la credenziale')
      } finally {
        setLoading(false)
      }
    }

    fetchCredential()
  }, [])

  const handleCopyCredentialId = () => {
    if (credential) {
      navigator.clipboard.writeText(credential.id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleCopyCredentialJson = () => {
    if (credential) {
      navigator.clipboard.writeText(JSON.stringify(credential, null, 2))
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!credential) return <ErrorState message="Credenziale digitale non disponibile" />

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credenziale Digitale (W3C)</h1>
          <p className="text-sm text-muted-foreground">
            Patente di cantiere in formato Verifiable Credential, firmata digitalmente con algoritmo Ed25519
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
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-500" />
                Patente di Cantiere Verificabile
              </CardTitle>
              <CardDescription className="text-xs font-mono">
                {credential.id}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-xs">
              Firma Valida
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-3.5 bg-muted/40 rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground font-semibold">Ente Emettitore</div>
              <div className="text-sm font-medium font-mono">{credential.issuer}</div>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground font-semibold">Data e Ora di Emissione</div>
              <div className="text-sm font-medium">
                {new Date(credential.issuanceDate).toLocaleString('it-IT')}
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Titolare e Dati Patente
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/50 p-3.5 rounded-lg space-y-1">
                <div className="text-xs text-muted-foreground">ID Lavoratore</div>
                <div className="text-sm font-mono font-semibold">{credential.credentialSubject.workerId}</div>
              </div>
              <div className="bg-muted/50 p-3.5 rounded-lg space-y-1">
                <div className="text-xs text-muted-foreground">Codice Riferimento Patente</div>
                <div className="text-xs font-mono break-all">{credential.credentialSubject.licenseRef}</div>
              </div>
            </div>
          </div>

          {/* Dettagli tecnici collassabili per mantenere l'interfaccia pulita e ordinata */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <span>Dettagli Tecnici della Firma Crittografica</span>
              <ChevronDown className={`size-4 transition-transform duration-200 ${showTechnicalDetails ? 'rotate-180' : ''}`} />
            </button>

            {showTechnicalDetails && (
              <div className="mt-3 bg-muted/30 p-3.5 rounded-lg space-y-2 text-xs font-mono border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algoritmo di Firma:</span>
                  <span>{credential.proof.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metodo di Verifica:</span>
                  <span>{credential.proof.verificationMethod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Firma Digitale:</span>
                  <span className="break-all text-[11px] block bg-background/80 p-2 rounded border">
                    {credential.proof.signature}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pulsanti di azione allineati */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" className="gap-2 text-xs h-10" onClick={handleCopyCredentialJson}>
          {copiedJson ? <Check className="size-4 text-emerald-500" /> : <FileCode className="size-4" />}
          {copiedJson ? 'JSON Copiato!' : 'Copia JSON Credenziale'}
        </Button>
        <Button variant="outline" className="gap-2 text-xs h-10" onClick={handleCopyCredentialId}>
          {copiedId ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          {copiedId ? 'ID Copiato!' : 'Copia ID Credenziale'}
        </Button>
        <Link href="/verify" className="w-full">
          <Button variant="default" className="w-full gap-2 text-xs h-10">
            <ExternalLink className="size-4" />
            Verifica Pubblica Esterna
          </Button>
        </Link>
      </div>
    </div>
  )
}
