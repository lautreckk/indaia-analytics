import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'admin' | 'consultor' | 'pre_vendedor';

export interface UserPermissions {
  role: UserRole;
  agentId: string | null;  // Para pré-vendedor: filtrar conversas
  tenantId: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
  loading: boolean;
}

// Definição de quais páginas cada role pode acessar
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    '/',
    '/conversations',
    '/analises',
    '/reunioes',
    '/transcriptor',
    '/reunioes/configuracoes',
    '/settings/agents',
    '/settings/teams',
    '/agents',
    '/reports',
    '/alerts',
    '/campaigns',
    '/settings/users',
    '/settings',
    '/material-apoio',
  ],
  consultor: [
    '/reunioes',
    '/transcriptor',
  ],
  pre_vendedor: [
    '/',
    '/conversations',
    '/analises',
    '/transcriptor',
  ],
};

// Itens do sidebar por role
export const SIDEBAR_ITEMS: Record<UserRole, string[]> = {
  admin: [
    'Dashboard',
    'Conversas',
    'Análises',
    'Reuniões',
    'Transcriptor',
    'Config. Reuniões',
    'Agentes IA',
    'Equipes IA',
    'Material de Apoio',
    'Atendentes',
    'Relatórios',
    'Alertas',
    'Campanhas',
    'Usuários',
    'Configurações',
  ],
  consultor: [
    'Reuniões',
    'Transcriptor',
  ],
  pre_vendedor: [
    'Dashboard',
    'Conversas',
    'Análises',
    'Transcriptor',
  ],
};

export function usePermissions(): UserPermissions {
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: 'pre_vendedor',
    agentId: null,
    tenantId: null,
    userId: null,
    name: null,
    email: null,
    loading: true,
  });

  useEffect(() => {
    async function loadPermissions() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setPermissions(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, agent_id, tenant_id, name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        setPermissions({
          role: profile.role as UserRole,
          agentId: profile.agent_id,
          tenantId: profile.tenant_id,
          userId: user.id,
          name: profile.name,
          email: profile.email,
          loading: false,
        });
      } else {
        setPermissions(prev => ({ ...prev, loading: false }));
      }
    }

    loadPermissions();
  }, []);

  return permissions;
}

// Helper para verificar se usuário pode acessar uma página
export function canAccessPage(role: UserRole, pathname: string): boolean {
  const allowedPages = ROLE_PERMISSIONS[role];
  
  // Verificar se o pathname começa com alguma página permitida
  return allowedPages.some(page => {
    if (page === '/') return pathname === '/';
    return pathname === page || pathname.startsWith(page + '/');
  });
}

// Helper para verificar se é admin
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

// Helper para verificar se pode ver tudo
export function canSeeAllData(role: UserRole): boolean {
  return role === 'admin';
}
