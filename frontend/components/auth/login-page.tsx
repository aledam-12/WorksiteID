'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, KeyRound, ShieldCheck, Smartphone, ExternalLink, UserPlus, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

export default function LoginPage() {
  const { loginPasskey, error } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [hybridNotice, setHybridNotice] = useState(false)

  const handlePasskeyLogin = async () => {
    setIsLoading(true)
    setLocalError(null)
    setHybridNotice(false)

    try {
      const authenticatedUser = await loginPasskey()
      // Redirect strictly based on backend-determined authenticated identity
      router.push(authenticatedUser.userType === 'worker' ? '/worker' : '/inspector')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Accesso con Passkey non riuscito'
      setLocalError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseAnotherDevice = () => {
    setHybridNotice(true)
    setLocalError(null)
    // Invokes standard browser WebAuthn hybrid cross-device prompt
    handlePasskeyLogin()
  }

  const displayedError = localError || error

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
            <ShieldCheck className="size-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">WorksiteID</CardTitle>
          <CardDescription>
            Piattaforma di Verifica e Gestione Patente a Crediti
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {displayedError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Autenticazione Fallita</AlertTitle>
              <AlertDescription>
                {displayedError}
              </AlertDescription>
            </Alert>
          )}

          {hybridNotice && (
            <div className="p-3 bg-muted/60 border rounded-md text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-primary" />
                Accesso Cross-Device FIDO2
              </div>
              <p>
                Il browser aprirà il prompt di sistema: scegli &quot;Usa un telefono o tablet&quot; per inquadrare il codice QR con la fotocamera del tuo smartphone.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handlePasskeyLogin}
              disabled={isLoading}
              size="lg"
              className="w-full h-13 gap-3 text-base font-semibold shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Verifica biometrica in corso...
                </>
              ) : (
                <>
                  <KeyRound className="size-5" />
                  Continua con Passkey
                </>
              )}
            </Button>

            <Button
              onClick={handleUseAnotherDevice}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="w-full gap-2 border-muted hover:border-primary/50 text-xs"
            >
              <Smartphone className="size-4 text-muted-foreground" />
              Usa un altro dispositivo (Smartphone / Chiave FIDO)
            </Button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Oppure Registrati</span>
            </div>
          </div>

          <Link href="/register">
            <Button
              variant="secondary"
              className="w-full gap-2 text-xs font-semibold"
            >
              <UserPlus className="size-4" />
              Registrati come nuovo Lavoratore
            </Button>
          </Link>

          <div className="pt-2 text-center border-t">
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Verifica pubblica credenziale W3C senza autenticazione</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
