'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, KeyRound, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, HardHat, UserCheck, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

type RegistrationStep = 'form' | 'passkey' | 'completed'

export default function RegisterPage() {
  const { registerWorker } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<RegistrationStep>('form')
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    cf: '',
    company: '',
    userType: 'worker' as 'worker' | 'inspector',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passkeyExecutor, setPasskeyExecutor] = useState<(() => Promise<void>) | null>(null)

  const validateForm = () => {
    if (!formData.name.trim()) return 'Il nome è obbligatorio.'
    if (!formData.surname.trim()) return 'Il cognome è obbligatorio.'
    const cfClean = formData.cf.trim().toUpperCase()
    if (!cfClean) return 'Il codice fiscale è obbligatorio.'
    if (cfClean.length !== 16) return 'Il codice fiscale deve essere di 16 caratteri.'
    if (formData.userType === 'worker' && !formData.company.trim()) {
      return "L'azienda o ragione sociale è obbligatoria per i lavoratori."
    }
    return null
  }

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      // Phase 1: validate and get registration challenge (NO active user created yet)
      const { registerPasskey } = await registerWorker({
        name: formData.name.trim(),
        surname: formData.surname.trim(),
        cf: formData.cf.trim().toUpperCase(),
        company: formData.userType === 'worker' ? formData.company.trim() : undefined,
        userType: formData.userType,
      })

      setPasskeyExecutor(() => registerPasskey)
      setStep('passkey')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore durante la preparazione della registrazione'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePasskey = async () => {
    if (!passkeyExecutor) return

    setIsLoading(true)
    setError(null)

    try {
      // Phase 2: User touches biometric sensor / passkey authenticator
      await passkeyExecutor()
      setStep('completed')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registrazione passkey non riuscita'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToForm = () => {
    setError(null)
    setStep('form')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg border-muted">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
            <ShieldCheck className="size-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">WorksiteID</CardTitle>
          <CardDescription>
            {formData.userType === 'inspector'
              ? 'Registrazione Ispettore di Cantiere e Abilitazione Vigilanza'
              : 'Registrazione Lavoratore e Abilitazione Patente a Crediti'}
          </CardDescription>

          {/* Stepper indicator */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs font-medium text-muted-foreground">
            <span className={`px-2.5 py-0.5 rounded-full ${step === 'form' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted'}`}>
              1. Dati
            </span>
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className={`px-2.5 py-0.5 rounded-full ${step === 'passkey' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted'}`}>
              2. Passkey
            </span>
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className={`px-2.5 py-0.5 rounded-full ${step === 'completed' ? 'bg-emerald-600 text-white font-bold' : 'bg-muted'}`}>
              3. Concluso
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Attenzione</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* STEP 1: FORM ANAGRAFICA */}
          {step === 'form' && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Seleziona il tuo Ruolo nel Cantiere</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, userType: 'worker' })}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formData.userType === 'worker'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-1.5">
                      <HardHat className="size-4.5" />
                    </div>
                    <span className="text-xs font-semibold">Lavoratore</span>
                    <span className="text-[10px] text-muted-foreground">Patente a crediti</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, userType: 'inspector' })}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      formData.userType === 'inspector'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-1.5">
                      <UserCheck className="size-4.5" />
                    </div>
                    <span className="text-xs font-semibold">Ispettore</span>
                    <span className="text-[10px] text-muted-foreground">Verifica e sanzioni</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <h3 className="text-sm font-semibold">
                  Step 1: Inserisci i tuoi Dati ({formData.userType === 'inspector' ? 'Ispettore' : 'Lavoratore'})
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formData.userType === 'inspector'
                    ? 'I dati saranno associati al tuo profilo ispettivo per le verifiche e sanzioni.'
                    : 'I dati saranno collegati alla tua patente privata a crediti protetta da ZKP.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="es. Mario"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="surname" className="text-xs font-medium">
                    Cognome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="surname"
                    placeholder="es. Rossi"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cf" className="text-xs font-medium">
                  Codice Fiscale <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cf"
                  placeholder="es. RSSMRA80A01H501U"
                  value={formData.cf}
                  onChange={(e) => setFormData({ ...formData, cf: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                  maxLength={16}
                  className="uppercase font-mono text-sm"
                  required
                />
              </div>

              {formData.userType === 'worker' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-xs font-medium">
                    Impresa Edile / Azienda <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company"
                    placeholder="es. Edilizia Moderna S.r.l."
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    disabled={isLoading}
                    required
                  />
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span>Ente di vigilanza e ispezione assegnato automaticamente.</span>
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="w-full gap-2 mt-2">
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    Continua verso la Protezione Passkey
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hai già un account registrato? Accedi qui
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: WEBAUTHN PASSKEY CREATION */}
          {step === 'passkey' && (
            <div className="space-y-5">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-semibold">Step 2: Proteggi il tuo Account</h3>
                <p className="text-xs text-muted-foreground">
                  WorksiteID non utilizza password. Crea una chiave crittografica Passkey (FIDO2) memorizzata sul chip di sicurezza di questo dispositivo.
                </p>
              </div>

              <div className="rounded-lg bg-muted/60 p-4 border text-xs space-y-2">
                <div className="font-semibold text-foreground">Riepilogo Registrazione:</div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ruolo:</span>
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    {formData.userType === 'inspector' ? (
                      <>
                        <UserCheck className="size-3.5" />
                        Ispettore
                      </>
                    ) : (
                      <>
                        <HardHat className="size-3.5" />
                        Lavoratore
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominativo:</span>
                  <span className="font-medium">{formData.name} {formData.surname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Codice Fiscale:</span>
                  <span className="font-mono">{formData.cf}</span>
                </div>
                {formData.userType === 'worker' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Azienda:</span>
                    <span className="font-medium">{formData.company}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-300">
                Se annulli la procedura biometrica/PIN sul tuo dispositivo, nessun account verrà memorizzato nel sistema.
              </div>

              <Button
                onClick={handleCreatePasskey}
                disabled={isLoading}
                size="lg"
                className="w-full h-12 gap-2 text-sm font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    In attesa del sensore Passkey...
                  </>
                ) : (
                  <>
                    <KeyRound className="size-5" />
                    Crea Passkey sul Dispositivo
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleBackToForm}
                disabled={isLoading}
                className="w-full gap-2 text-xs"
              >
                <ArrowLeft className="size-3" />
                Modifica Dati Anagrafici
              </Button>
            </div>
          )}

          {/* STEP 3: COMPLETED */}
          {step === 'completed' && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  Account {formData.userType === 'inspector' ? 'Ispettore' : 'Lavoratore'} Registrato e Protetto
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formData.userType === 'inspector'
                    ? 'La tua passkey è stata registrata con successo. Il tuo profilo ispettivo è abilitato per verificare le patenti ed emettere sanzioni.'
                    : 'La tua passkey è stata registrata con successo e la tua patente a crediti è attiva nel sistema protetto.'}
                </p>
              </div>

              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruolo:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formData.userType === 'inspector' ? 'ISPETTORE DI CANTIERE' : 'LAVORATORE EDILE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credenziali di Sicurezza:</span>
                  <span className="font-medium">Passkey FIDO2 Hardware-Bound</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {formData.userType === 'inspector' ? 'Autorizzazioni:' : 'Idoneità al Varco:'}
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formData.userType === 'inspector' ? 'VERIFICA PATENTE & SANZIONI' : 'ABILITATO (ZKP)'}
                  </span>
                </div>
              </div>

              <Button
                onClick={() => router.push(formData.userType === 'inspector' ? '/inspector' : '/worker')}
                size="lg"
                className="w-full gap-2"
              >
                Vai alla Dashboard {formData.userType === 'inspector' ? 'Ispettore' : 'Lavoratore'}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
