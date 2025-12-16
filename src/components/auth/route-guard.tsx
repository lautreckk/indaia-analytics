'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions, canAccessPage } from '@/hooks/use-permissions';
import { Loader2, ShieldX } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading } = usePermissions();

  // Verificar permissão
  const hasAccess = canAccessPage(role, pathname);

  // Se for consultor e tentar acessar outra página, redirecionar para reuniões
  useEffect(() => {
    if (!loading && role === 'consultor' && pathname !== '/reunioes' && !pathname.startsWith('/reunioes/')) {
      router.replace('/reunioes');
    }
  }, [role, pathname, router, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!hasAccess) {
    // Se for consultor, não mostrar a tela de erro, apenas redirecionar
    if (role === 'consultor') {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">Acesso Restrito</h2>
        <p className="text-zinc-500 text-center max-w-md">
          Você não tem permissão para acessar esta página.
          <br />
          Entre em contato com o administrador se precisar de acesso.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
