'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/shared/status-badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { apiClient } from '@/lib/api/client'
import type { License } from '@/lib/api/types'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Award, CheckCircle2, CreditCard, User, Building2, KeyRound, Loader2, Check } from 'lucide-react'

export default function WorkerDashboard() {
  const { user, addPasskey } = useAuth()
  const [license, setLicense] = useState<License | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeySuccess, setPasskeySuccess] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        const data = await apiClient.worker.getLicense()
        setLicense(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossibile caricare lo stato della patente')
      } finally {
        setLoading(false)
      }
    }

    fetchLicense()
  }, [])

  const handleAddPasskey = async () => {
    setPasskeyLoading(true)
    setPasskeySuccess(false)
    setPasskeyError(null)

    try {
      await addPasskey()
      setPasskeySuccess(true)
      setTimeout(() => setPasskeySuccess(false), 5000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Aggiunta passkey fallita'
      setPasskeyError(msg)
    } finally {
      setPasskeyLoading(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!license) return <ErrorState message="Dati patente non disponibili" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pannello Lavoratore</h1>
        <p className="text-muted-foreground">Panoramica del profilo di cantiere, stato patente e sicurezza</p>
      </div>

      {/* 1. Worker Profile Card (Name, Surname, Company, CF) */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-primary" />
            Profilo Lavoratore Autenticato
          </CardTitle>
          <CardDescription>
            Identità di cantiere verificata tramite autenticazione WebAuthn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Nome e Cognome</span>
              <div className="text-sm font-semibold">{user?.name} {user?.surname}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Codice Fiscale</span>
              <div className="text-sm font-mono font-semibold">{user?.cf || '—'}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3" />
                Impresa Edile
              </span>
              <div className="text-sm font-medium">{user?.company || '—'}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Worker ID</span>
              <div className="text-xs font-mono text-muted-foreground">{user?.userId}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. License Status & Gate Eligibility (STRICT ZKP: No numeric credit count) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stato Patente a Crediti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={license.status} />
              <span className="text-xs font-mono text-muted-foreground">Versione {license.version}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {license.status === 'ACTIVE'
                ? 'La patente è attiva e conforme ai requisiti di legge.'
                : 'La patente è revocata a seguito di provvedimento sanzionatorio.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Idoneità Accesso al Varco (Gate ZKP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <StatusBadge status={license.verificationEligibility} />
            </div>
            <div className="text-xs text-muted-foreground">
              {license.verificationEligibility === 'ELIGIBLE'
                ? 'Requisiti soddisfatti (soglia minima ≥ 15 crediti dimostrabile in Zero-Knowledge).'
                : 'Accesso interdetto: patente revocata o crediti insufficienti (< 15).'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Multi-Device Passkey Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Dispositivi di Sicurezza e Passkey
          </CardTitle>
          <CardDescription>
            Gestisci l&apos;accesso multi-dispositivo associando un nuovo telefono, tablet o computer al tuo account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {passkeySuccess && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <Check className="size-4 text-emerald-600" />
              <AlertDescription>
                Nuova passkey registrata con successo e associata al tuo account.
              </AlertDescription>
            </Alert>
          )}

          {passkeyError && (
            <Alert variant="destructive">
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="text-xs text-muted-foreground">
              Il sistema supporta più passkey FIDO2 registrate sullo stesso account lavoratore senza condividere chiavi private.
            </div>
            <Button
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
            >
              {passkeyLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Registrazione in corso...
                </>
              ) : (
                <>
                  <KeyRound className="size-3.5" />
                  Aggiungi una nuova Passkey
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Operazioni di Cantiere</CardTitle>
          <CardDescription>
            Avvia la verifica crittografica ZKP per l&apos;ingresso o consulta la tua Verifiable Credential
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/worker/verify">
            <Button className="gap-2">
              <CheckCircle2 className="size-4" />
              Verifica Accesso Gate (ZKP)
            </Button>
          </Link>
          <Link href="/worker/credential">
            <Button variant="outline" className="gap-2">
              <Award className="size-4" />
              Visualizza Credenziale W3C
            </Button>
          </Link>
          <Link href="/worker/license">
            <Button variant="ghost" className="gap-2">
              <CreditCard className="size-4" />
              Dettagli Patente
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
