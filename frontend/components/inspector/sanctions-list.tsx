'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { apiClient } from '@/lib/api/client'
import type { Sanction } from '@/lib/api/types'
import { Plus, Search, Gavel, Calendar, ArrowLeft, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export default function SanctionsList() {
  const [sanctions, setSanctions] = useState<Sanction[]>([])
  const [filteredSanctions, setFilteredSanctions] = useState<Sanction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchLicense, setSearchLicense] = useState('')

  const fetchSanctions = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.inspector.getSanctions()
      setSanctions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare il registro delle sanzioni')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSanctions()
  }, [])

  useEffect(() => {
    const filtered = sanctions.filter((sanction) =>
      sanction.licenseRef.toLowerCase().includes(searchLicense.toLowerCase()) ||
      sanction.reason.toLowerCase().includes(searchLicense.toLowerCase()) ||
      sanction.sanctionId.toLowerCase().includes(searchLicense.toLowerCase())
    )
    setFilteredSanctions(filtered)
  }, [sanctions, searchLicense])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro Sanzioni di Cantiere</h1>
          <p className="text-sm text-muted-foreground">Storico dei provvedimenti disciplinari e delle decurtazioni crediti</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inspector">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="size-4" />
              Panoramica
            </Button>
          </Link>
          <Link href="/inspector/sanctions/new">
            <Button size="sm" className="gap-2 text-xs">
              <Plus className="size-4" />
              Emetti Sanzione
            </Button>
          </Link>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              id="search"
              placeholder="Cerca nel registro per Codice Patente, Numero Verbale o Motivazione..."
              value={searchLicense}
              onChange={(e) => setSearchLicense(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {filteredSanctions.length === 0 ? (
        <EmptyState message="Nessuna sanzione presente o corrispondente ai criteri di ricerca." />
      ) : (
        <div className="space-y-3">
          {filteredSanctions.map((sanction) => (
            <Card key={sanction.sanctionId} className="border-muted shadow-sm hover:border-primary/40 transition-colors">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b pb-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Gavel className="size-4 text-destructive" />
                      <span className="font-mono font-bold text-sm">{sanction.sanctionId}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ispettore Verbalizzante: <span className="font-mono">{sanction.inspectorRef}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-base font-bold text-destructive">-{sanction.penalty} crediti</div>
                    <div className="text-xs text-muted-foreground flex items-center sm:justify-end gap-1 mt-0.5">
                      <Calendar className="size-3" />
                      {sanction.issuedAt}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5 font-medium">Patente Sanzionata:</span>
                    <div className="font-mono break-all p-2 bg-muted/40 rounded border text-[11px]">
                      {sanction.licenseRef}
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground block mb-0.5 font-medium">Motivazione dell&apos;Infrazione:</span>
                    <div className="text-xs font-medium text-foreground bg-muted/20 p-2 rounded">
                      {sanction.reason}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
