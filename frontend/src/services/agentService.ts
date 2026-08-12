import api from "@/lib/api";
import { User } from "@/lib/types";

export interface AgentOnboardPayload {
  email: string;
  password: string;
  full_name: string;
  assigned_channel_ids?: string[];
  assigned_campaign_ids?: string[];
}

export interface AgentsListResponse {
  agents: User[];
  total: number;
}

export const getAgents = async (): Promise<AgentsListResponse> => {
  const response = await api.get("/api/users/agents");
  if (Array.isArray(response.data)) {
    return { agents: response.data, total: response.data.length };
  }
  return response.data || { agents: [], total: 0 };
};

export const onboardAgent = async (data: AgentOnboardPayload): Promise<User> => {
  const response = await api.post("/api/users/agents", data);
  return response.data;
};

export const assignAgentChannels = async (
  agentId: string,
  channelIds: string[]
): Promise<any> => {
  const response = await api.post(`/api/users/agents/${agentId}/channel-assignments`, {
    whatsapp_account_ids: channelIds,
    channel_ids: channelIds,
  });
  return response.data;
};

export const assignAgentCampaigns = async (
  agentId: string,
  campaignIds: string[]
): Promise<any> => {
  const response = await api.post(`/api/users/agents/${agentId}/campaign-assignments`, {
    campaign_ids: campaignIds,
    user_ids: [agentId],
  });
  return response.data;
};

export const assignContactsToAgent = async (
  contactIds: string[],
  agentId: string | null
): Promise<any> => {
  const response = await api.post("/api/contacts/assign", {
    contact_ids: contactIds,
    assignee_id: agentId,
  });
  return response.data;
};

export const updateAgent = async (
  agentId: string,
  payload: { full_name?: string; password?: string; status?: string }
): Promise<any> => {
  const response = await api.patch(`/api/users/agents/${agentId}`, payload);
  return response.data;
};

export const toggleAgentStatus = async (agentId: string): Promise<any> => {
  const response = await api.post(`/api/users/agents/${agentId}/toggle-status`);
  return response.data;
};

export const deleteAgent = async (agentId: string): Promise<any> => {
  const response = await api.delete(`/api/users/agents/${agentId}`);
  return response.data;
};

const agentService = {
  getAgents,
  onboardAgent,
  updateAgent,
  toggleAgentStatus,
  deleteAgent,
  assignAgentChannels,
  assignAgentCampaigns,
  assignContactsToAgent,
};

export default agentService;
