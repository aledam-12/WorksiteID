'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { apiClient } from '@/lib/api/client'
import type { Credential } from '@/lib/api/types'
import { Copy, Check, ShieldCheck, FileCode, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function WorkerCredentialPage() {
  const [credential, setCredential] = useState<Credential | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

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
  if (!credential) return <ErrorState message="Credenziale non disponibile" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verifiable Credential (W3C)</h1>
        <p className="text-muted-foreground">
          Credenziale verificabile conforme allo standard W3C, firmata crittograficamente con algoritmo Ed25519.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-500" />
                WorksiteLicenseCredential
              </CardTitle>
              <CardDescription className="text-xs font-mono mt-1">
                {credential.id}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">
              Ed25519 FIRMATA
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Ente Emettitore (Issuer)</div>
              <div className="text-sm font-medium font-mono">{credential.issuer}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Data di Emissione</div>
              <div className="text-sm font-medium">
                {new Date(credential.issuanceDate).toLocaleString('it-IT')}
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Oggetto della Credenziale (Credential Subject)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/50 p-3 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Identificativo Lavoratore</div>
                <div className="text-sm font-mono font-semibold">{credential.credentialSubject.workerId}</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Riferimento Patente (licenseRef)</div>
                <div className="text-xs font-mono break-all">{credential.credentialSubject.licenseRef}</div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Firma Crittografica (Proof)</div>
            <div className="bg-muted/30 p-3 rounded-md space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo Prova:</span>
                <span>{credential.proof.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metodo di Verifica:</span>
                <span>{credential.proof.verificationMethod}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Valore Firma (Base64):</span>
                <span className="break-all text-[11px] block bg-background/50 p-2 rounded border">
                  {credential.proof.signature}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyCredentialJson}>
          {copiedJson ? <Check className="size-4 text-emerald-500" /> : <FileCode className="size-4" />}
          {copiedJson ? 'JSON Copiato negli Appunti!' : 'Copia JSON Completo per Verifica'}
        </Button>
        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyCredentialId}>
          {copiedId ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          {copiedId ? 'ID Copiato!' : 'Copia ID Credenziale'}
        </Button>
        <Link href="/verify" className="flex-1">
          <Button variant="default" className="w-full gap-2">
            <ExternalLink className="size-4" />
            Verifica Pubblica Credenziale
          </Button>
        </Link>
      </div>
    </div>
  )
}
