'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { apiClient } from '@/lib/api/client'
import type { Sanction } from '@/lib/api/types'
import { Plus, Search, Gavel, Calendar } from 'lucide-react'
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
      setError(err instanceof Error ? err.message : 'Impossibile caricare il registro sanzioni')
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registro Sanzioni di Cantiere</h1>
          <p className="text-muted-foreground">Storico delle sanzioni e decurtazioni crediti applicate</p>
        </div>
        <Link href="/inspector/sanctions/new">
          <Button className="gap-2">
            <Plus className="size-4" />
            Nuova Sanzione
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            Filtra Registro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Input
              id="search"
              placeholder="Cerca per Riferimento Patente, ID Sanzione o Motivazione..."
              value={searchLicense}
              onChange={(e) => setSearchLicense(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {filteredSanctions.length === 0 ? (
        <EmptyState message="Nessuna sanzione trovata con i criteri selezionati." />
      ) : (
        <div className="space-y-4">
          {filteredSanctions.map((sanction) => (
            <Card key={sanction.sanctionId} className="border-muted hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b pb-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Gavel className="size-4 text-destructive" />
                      <span className="font-mono font-bold text-base">{sanction.sanctionId}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Emessa da Ispettore: <span className="font-mono">{sanction.inspectorRef}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-destructive">-{sanction.penalty} crediti</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="size-3" />
                        {sanction.issuedAt}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Riferimento Patente Sanzionata</div>
                    <div className="text-xs font-mono break-all p-2 bg-muted/40 rounded">
                      {sanction.licenseRef}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Motivazione Verbale</div>
                    <div className="text-sm font-medium">{sanction.reason}</div>
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
