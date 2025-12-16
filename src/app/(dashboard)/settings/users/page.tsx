'use client';

import { useState } from 'react';
import { 
  Shield, 
  Plus, 
  Pencil, 
  UserCheck, 
  UserX,
  Loader2,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUsers, useUpdateUser, useIsAdmin, User } from '@/hooks/use-users';
import { useChatwootAgents } from '@/hooks/use-chatwoot-agents';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  admin: { 
    label: 'Administrador', 
    color: 'bg-red-100 text-red-800',
    description: 'Acesso total ao sistema'
  },
  consultor: { 
    label: 'Consultor', 
    color: 'bg-blue-100 text-blue-800',
    description: 'Visualiza relatórios e conversas'
  },
  pre_vendedor: { 
    label: 'Pré-vendedor', 
    color: 'bg-green-100 text-green-800',
    description: 'Acesso apenas às próprias conversas'
  },
};

export default function UsersPage() {
  const { users, loading, refetch } = useUsers();
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const updateUser = useUpdateUser();
  const { agents } = useChatwootAgents();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    role: 'pre_vendedor' as 'admin' | 'consultor' | 'pre_vendedor',
    password: '',
    agent_id: '',
  });

  // Verificar acesso
  if (loadingAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Shield className="h-16 w-16 text-zinc-300" />
        <h2 className="text-xl font-semibold text-zinc-700">Acesso Restrito</h2>
        <p className="text-zinc-500">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  const handleRoleChange = (role: 'admin' | 'consultor' | 'pre_vendedor') => {
    setNewUserForm(prev => ({
      ...prev,
      role,
      agent_id: '', // Limpa apenas o agent_id
    }));
  };

  const handleCreateUser = async () => {
    // Validações básicas
    if (!newUserForm.email || !newUserForm.name || !newUserForm.password) {
      toast.warning('Campos obrigatórios', {
        description: 'Preencha email, nome e senha',
      });
      return;
    }

    if (newUserForm.password.length < 6) {
      toast.warning('Senha fraca', {
        description: 'A senha deve ter pelo menos 6 caracteres',
      });
      return;
    }

    // Validar vinculações
    if (newUserForm.role === 'pre_vendedor' && !newUserForm.agent_id) {
      toast.warning('Vinculação obrigatória', {
        description: 'Pré-vendedor deve ser vinculado a um Atendente',
      });
      return;
    }

    setCreating(true);
    try {
      // Buscar tenant_id do admin atual
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', currentUser?.id)
        .single();

      if (!adminProfile?.tenant_id) throw new Error('Tenant não encontrado');

      // Chamar API Route (não desloga o admin!)
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserForm.email,
          password: newUserForm.password,
          name: newUserForm.name,
          role: newUserForm.role,
          tenant_id: adminProfile.tenant_id,
          agent_id: newUserForm.role === 'pre_vendedor' ? newUserForm.agent_id : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast.success('Usuário criado!', {
        description: `${newUserForm.name} foi adicionado como ${ROLE_LABELS[newUserForm.role].label}`,
      });

      setIsCreateOpen(false);
      setNewUserForm({ 
        email: '', 
        name: '', 
        role: 'pre_vendedor', 
        password: '',
        agent_id: '',
      });
      refetch();
    } catch (err: any) {
      toast.error('Erro ao criar usuário', {
        description: err.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateUser.update(userId, { role: newRole as any });
      toast.success('Permissão atualizada!');
      refetch();
    } catch (err: any) {
      toast.error('Erro ao atualizar', {
        description: err.message,
      });
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await updateUser.update(user.id, { active: !user.active });
      toast.success(user.active ? 'Usuário desativado' : 'Usuário ativado');
      refetch();
    } catch (err: any) {
      toast.error('Erro ao atualizar', {
        description: err.message,
      });
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    try {
      await updateUser.update(selectedUser.id, {
        name: selectedUser.name,
        role: selectedUser.role,
      });
      toast.success('Usuário atualizado!');
      setIsEditOpen(false);
      setSelectedUser(null);
      refetch();
    } catch (err: any) {
      toast.error('Erro ao atualizar', {
        description: err.message,
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Usuários e Permissões
          </h1>
          <p className="text-zinc-500 mt-1">
            Gerencie os usuários e níveis de acesso do sistema
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Cards de resumo por role */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(ROLE_LABELS).map(([role, info]) => {
          const count = users.filter(u => u.role === role && u.active).length;
          return (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className={info.color}>{info.label}</Badge>
                </CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-sm text-zinc-500">usuário{count !== 1 ? 's' : ''} ativo{count !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela de usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários</CardTitle>
          <CardDescription>
            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={!user.active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-zinc-100 text-zinc-600 text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name || 'Sem nome'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleUpdateRole(user.id, value)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              Administrador
                            </span>
                          </SelectItem>
                          <SelectItem value="consultor">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Consultor
                            </span>
                          </SelectItem>
                          <SelectItem value="pre_vendedor">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Pré-vendedor
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? 'default' : 'secondary'}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditUser(user)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleActive(user)}
                          title={user.active ? 'Desativar' : 'Ativar'}
                          className={user.active ? 'text-red-600' : 'text-green-600'}
                        >
                          {user.active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Usuário */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Adicione um novo usuário ao sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <div className="relative mt-1.5">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Email *</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Senha *</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Nível de Acesso</Label>
              <Select
                value={newUserForm.role}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">Administrador</span>
                      <span className="text-xs text-zinc-500">Acesso total</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="consultor">
                    <div className="flex flex-col">
                      <span className="font-medium">Consultor</span>
                      <span className="text-xs text-zinc-500">Relatórios e conversas</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pre_vendedor">
                    <div className="flex flex-col">
                      <span className="font-medium">Pré-vendedor</span>
                      <span className="text-xs text-zinc-500">Apenas próprias conversas</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campo condicional: Atendente (para pré-vendedor) */}
            {newUserForm.role === 'pre_vendedor' && (
              <div>
                <Label>Vincular ao Atendente *</Label>
                <Select
                  value={newUserForm.agent_id}
                  onValueChange={(value) => setNewUserForm(prev => ({ ...prev, agent_id: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o atendente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.length === 0 ? (
                      <div className="p-2 text-sm text-zinc-500 text-center">
                        Nenhum atendente cadastrado
                      </div>
                    ) : (
                      agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {agent.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500 mt-1">
                  Este usuário só verá conversas deste atendente
                </p>
              </div>
            )}

          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuário */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={selectedUser.name || ''}
                  onChange={(e) => setSelectedUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  value={selectedUser.email}
                  disabled
                  className="mt-1.5 bg-zinc-100"
                />
              </div>

              <div>
                <Label>Nível de Acesso</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value: any) => setSelectedUser(prev => prev ? { ...prev, role: value } : null)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="pre_vendedor">Pré-vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUser.loading}>
              {updateUser.loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
