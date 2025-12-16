// Agente individual
export interface AIAgent {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  prompt_system: string;
  prompt_business: string | null;
  prompt_output: string;
  is_template: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Equipe
export interface AITeam {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  event_type: 'casamento' | '15_anos' | null;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Membro da equipe (agente + peso)
export interface AITeamMember {
  id: string;
  team_id: string;
  agent_id: string;
  weight: number;
  sort_order: number;
  prompt_business_override: string | null;
  is_active: boolean;
  created_at: string;
  // Joined data
  agent?: AIAgent;
}

// View consolidada
export interface TeamAgentView {
  team_id: string;
  tenant_id: string;
  team_name: string;
  event_type: string | null;
  is_default: boolean;
  member_id: string;
  weight: number;
  sort_order: number;
  prompt_business_override: string | null;
  agent_id: string;
  agent_key: string;
  agent_name: string;
  agent_description: string | null;
  icon: string;
  prompt_system: string;
  prompt_business: string | null;
  prompt_output: string;
  is_template: boolean;
}

// Equipe com membros (para UI)
export interface AITeamWithMembers extends AITeam {
  members: (AITeamMember & { agent: AIAgent })[];
  total_weight: number;
}

// Form data
export interface AgentFormData {
  key: string;
  name: string;
  description: string;
  icon: string;
  prompt_system: string;
  prompt_business: string;
  prompt_output: string;
}

export interface TeamFormData {
  name: string;
  description: string;
  event_type: 'casamento' | '15_anos' | null;
  is_default: boolean;
}

export interface TeamMemberFormData {
  agent_id: string;
  weight: number;
  prompt_business_override?: string;
}
