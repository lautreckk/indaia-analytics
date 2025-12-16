import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-zinc-400">
          Configurações de roteiros, frases de origem e usuários
        </CardContent>
      </Card>
    </div>
  )
}
