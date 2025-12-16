import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Alertas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Erros</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-zinc-400">
          Alertas serão exibidos quando erros forem detectados nas conversas
        </CardContent>
      </Card>
    </div>
  )
}
