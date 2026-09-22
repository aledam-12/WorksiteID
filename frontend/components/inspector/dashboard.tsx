'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { CheckCircle2, Gavel, FileText, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react'

export default function InspectorDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Intestazione */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pannello Ispettore di Vigilanza</h1>
          <p className="text-sm text-muted-foreground">
            Verifiche di conformità patenti, gestione verbali e provvedimenti sanzionatori
          </p>
        </div>
        <Link href="/inspector/verify">
          <Button className="gap-2 shrink-0">
            <CheckCircle2 className="size-4" />
            Verifica Nuova Patente
          </Button>
        </Link>
      </div>

      {/* Profilo Ispettore */}
      <Card className="border-muted shadow-sm">
        <CardHeader className="pb-3 pt-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <UserCheck className="size-4 text-primary" />
            Profilo Ispettore Autenticato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Nome e Cognome</span>
              <div className="text-sm font-semibold">{user?.name} {user?.surname}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Ruolo Istituzionale</span>
              <div className="text-sm font-semibold text-primary">Ispettore di Cantiere</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Ente Assegnato</span>
              <div className="text-sm font-medium">Vigilanza Tecnica / ASL</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">ID Ispettore</span>
              <div className="text-xs font-mono text-muted-foreground">{user?.userId}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sezioni Operative Principali */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Verifica Stato Patente</CardTitle>
                <CardDescription className="text-xs">
                  Controlla in tempo reale idoneità operativa e conformità di legge
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Inserisci il codice identificativo della patente per consultare lo stato di validità senza violare la privacy del lavoratore.
            </p>
            <Link href="/inspector/verify" className="block pt-1">
              <Button className="w-full gap-2">
                <CheckCircle2 className="size-4" />
                Avvia Verifica Patente
                <ArrowRight className="size-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:border-destructive/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                <Gavel className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Emetti Sanzione</CardTitle>
                <CardDescription className="text-xs">
                  Registra infrazioni e applica decurtazioni di crediti
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Compila il verbale di contestazione con decurtazione crediti e registrazione immutabile su registro distribuito.
            </p>
            <Link href="/inspector/sanctions/new" className="block pt-1">
              <Button variant="outline" className="w-full gap-2 border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                <Gavel className="size-4" />
                Compila Verbale Sanzione
                <ArrowRight className="size-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Registro Storico Sanzioni */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">Registro Storico Sanzioni</CardTitle>
            </div>
            <Link href="/inspector/sanctions">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Visualizza Tutte
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          <CardDescription className="text-xs">
            Consulta l&apos;elenco completo delle sanzioni applicate e dei crediti decurtati nel cantiere
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/40 rounded-lg gap-3">
            <div className="text-xs text-muted-foreground">
              Accedi al registro per effettuare ricerche per codice patente, ID sanzione o motivazione dell&apos;infrazione.
            </div>
            <Link href="/inspector/sanctions">
              <Button variant="secondary" size="sm" className="gap-2 text-xs shrink-0">
                <FileText className="size-3.5" />
                Apri Registro Completo
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
