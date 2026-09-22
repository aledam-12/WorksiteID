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
import { Award, CheckCircle2, CreditCard, User, Building2, KeyRound, Loader2, Check, ShieldCheck } from 'lucide-react'

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
  if (!license) return <ErrorState message="Dati della patente non disponibili" />

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Intestazione pagina */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panoramica Lavoratore</h1>
          <p className="text-sm text-muted-foreground">Profilo di cantiere, stato di conformità e sicurezza biometrica</p>
        </div>
        <Link href="/worker/verify">
          <Button className="gap-2 shrink-0">
            <CheckCircle2 className="size-4" />
            Verifica Ingresso Varco
          </Button>
        </Link>
      </div>

      {/* Profilo Lavoratore */}
      <Card className="border-muted shadow-sm">
        <CardHeader className="pb-3 pt-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <User className="size-4 text-primary" />
            Anagrafica Lavoratore
          </CardTitle>
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
              <span className="text-xs text-muted-foreground">ID Lavoratore</span>
              <div className="text-xs font-mono text-muted-foreground">{user?.userId}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stato Patente e Idoneità Varco */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Stato Patente a Crediti
              </CardTitle>
              <StatusBadge status={license.status} />
            </div>
            <CardDescription className="text-xs">
              Conformità normativa ai sensi del D.Lgs. 81/2008
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Condizione Operativa:</span>
                <span className="font-semibold">
                  {license.status === 'ACTIVE' ? 'Patente Regolare' : 'Patente Sospesa / Revocata'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versione di Stato:</span>
                <span className="font-mono">v{license.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ultimo Aggiornamento:</span>
                <span className="font-mono">{license.lastUpdated}</span>
              </div>
            </div>
            <Link href="/worker/license" className="block pt-1">
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                Visualizza dettagli patente →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Controllo Accesso al Varco
              </CardTitle>
              <StatusBadge status={license.verificationEligibility} />
            </div>
            <CardDescription className="text-xs">
              Verifica dei requisiti minimi per l&apos;ingresso in cantiere
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requisito Minimo:</span>
                <span className="font-semibold">Soglia ≥ 15 Crediti</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Riservatezza Dati:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Crediti protetti da Zero-Knowledge</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esito Autorizzativo:</span>
                <span className="font-semibold">
                  {license.verificationEligibility === 'ELIGIBLE' ? 'Accesso Consentito' : 'Ingresso Interdetto'}
                </span>
              </div>
            </div>
            <Link href="/worker/verify" className="block pt-1">
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                Avvia verifica varco →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Operazioni Rapide */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/worker/verify">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Verifica Ingresso
              </div>
              <p className="text-xs text-muted-foreground">
                Genera la prova crittografica per superare il varco di cantiere
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/credential">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Award className="size-4 text-primary" />
                Credenziale Digitale
              </div>
              <p className="text-xs text-muted-foreground">
                Consulta la patente firmata in formato standard W3C
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/license">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-5 pb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CreditCard className="size-4 text-amber-500" />
                Stato Patente
              </div>
              <p className="text-xs text-muted-foreground">
                Dettagli di conformità e codice identificativo di cantiere
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Gestione Passkey */}
      <Card className="border-muted shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Dispositivi di Sicurezza e Passkey
          </CardTitle>
          <CardDescription className="text-xs">
            Accedi da più dispositivi (smartphone, tablet o PC) associando nuove chiavi di sicurezza al tuo account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {passkeySuccess && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <Check className="size-4 text-emerald-600" />
              <AlertDescription className="text-xs">
                Nuova passkey registrata con successo e associata al tuo account.
              </AlertDescription>
            </Alert>
          )}

          {passkeyError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{passkeyError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Ogni dispositivo registrato conserva la propria chiave crittografica hardware in totale sicurezza.
            </p>
            <Button
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 text-xs"
            >
              {passkeyLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Registrazione in corso...
                </>
              ) : (
                <>
                  <KeyRound className="size-3.5" />
                  Aggiungi Passkey
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
