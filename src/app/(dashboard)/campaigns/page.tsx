import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Campanhas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Origem dos Leads</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-zinc-400">
          Análise de origem/campanha será exibida após configuração das frases
        </CardContent>
      </Card>
    </div>
  )
}
