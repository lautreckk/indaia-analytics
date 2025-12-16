'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions, SIDEBAR_ITEMS } from '@/hooks/use-permissions';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Video,
  Settings,
  Bot,
  Users,
  UserCheck,
  FileText,
  Bell,
  Target,
  Shield,
  Loader2,
  TreePalm,
  Mic,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

// Todos os itens de navegação
const ALL_NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Conversas', href: '/conversations', icon: MessageSquare },
  { name: 'Análises', href: '/analises', icon: BarChart3 },
  { name: 'Reuniões', href: '/reunioes', icon: Video },
  { name: 'Transcriptor', href: '/transcriptor', icon: Mic },
  { name: 'Config. Reuniões', href: '/reunioes/configuracoes', icon: Settings },
  { name: 'Agentes IA', href: '/settings/agents', icon: Bot },
  { name: 'Equipes IA', href: '/settings/teams', icon: Users },
  { name: 'Material de Apoio', href: '/material-apoio', icon: BookOpen },
  { name: 'Atendentes', href: '/agents', icon: UserCheck },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Alertas', href: '/alerts', icon: Bell },
  { name: 'Campanhas', href: '/campaigns', icon: Target },
  { name: 'Usuários', href: '/settings/users', icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, name, loading } = usePermissions();

  // Filtrar itens baseado no role
  const allowedItemNames = SIDEBAR_ITEMS[role] || [];
  const filteredNavItems = ALL_NAV_ITEMS.filter(item => 
    allowedItemNames.includes(item.name)
  );

  // Verificar se Configurações está permitido
  const canSeeSettings = role === 'admin';

  if (loading) {
    return (
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-zinc-200">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white border-r border-zinc-200">
        {/* Logo */}
        <div className="flex items-center gap-2 h-16 px-6 border-b border-zinc-200">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <TreePalm className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl font-semibold">
            Indaiá <span className="font-normal text-zinc-400">Analytics</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-zinc-600 hover:bg-zinc-100'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info no footer */}
        <div className="px-3 py-4 border-t border-zinc-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium">
              {name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{name || 'Usuário'}</p>
              <p className="text-xs text-zinc-500 capitalize">{role.replace('_', '-')}</p>
            </div>
          </div>
          
          {/* Settings - apenas para admin */}
          {canSeeSettings && (
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors mt-2',
                pathname === '/settings'
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-zinc-600 hover:bg-zinc-100'
              )}
            >
              <Settings className="w-5 h-5" />
              Configurações
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
