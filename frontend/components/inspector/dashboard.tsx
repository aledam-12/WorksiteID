'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, Gavel, FileText } from 'lucide-react'

export default function InspectorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inspector Dashboard</h1>
        <p className="text-muted-foreground">Manage license verifications and sanctions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verify License</CardTitle>
            <CardDescription>
              Check worker license status and eligibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/inspector/verify">
              <Button className="w-full">
                <CheckCircle2 className="mr-2 size-4" />
                Verify License
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue Sanction</CardTitle>
            <CardDescription>
              Record penalties against worker licenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/inspector/sanctions/new">
              <Button className="w-full">
                <Gavel className="mr-2 size-4" />
                Issue Sanction
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sanctions</CardTitle>
          <CardDescription>
            Last issued penalties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/inspector/sanctions">
            <Button variant="outline" className="w-full">
              <FileText className="mr-2 size-4" />
              View All Sanctions
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
