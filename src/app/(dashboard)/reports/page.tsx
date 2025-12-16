import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Relatórios</h1>
      <Card>
        <CardHeader>
          <CardTitle>Relatórios de Performance</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-zinc-400">
          Relatórios serão gerados automaticamente após análises
        </CardContent>
      </Card>
    </div>
  )
}
