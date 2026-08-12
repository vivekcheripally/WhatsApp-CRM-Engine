import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAgents,
  onboardAgent,
  updateAgent,
  toggleAgentStatus,
  deleteAgent,
  assignAgentChannels,
  assignAgentCampaigns,
  assignContactsToAgent,
  AgentOnboardPayload,
} from "@/services/agentService";

export function useAgents() {
  const queryClient = useQueryClient();

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
    staleTime: 0,
  });

  const onboardAgentMutation = useMutation({
    mutationFn: (payload: AgentOnboardPayload) => onboardAgent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ agentId, payload }: { agentId: string; payload: { full_name?: string; password?: string; status?: string } }) =>
      updateAgent(agentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (agentId: string) => toggleAgentStatus(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const assignChannelsMutation = useMutation({
    mutationFn: ({ agentId, channelIds }: { agentId: string; channelIds: string[] }) =>
      assignAgentChannels(agentId, channelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const assignCampaignsMutation = useMutation({
    mutationFn: ({ agentId, campaignIds }: { agentId: string; campaignIds: string[] }) =>
      assignAgentCampaigns(agentId, campaignIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const assignContactsMutation = useMutation({
    mutationFn: ({ contactIds, agentId }: { contactIds: string[]; agentId: string | null }) =>
      assignContactsToAgent(contactIds, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    agents: agentsQuery.data?.agents ?? [],
    total: agentsQuery.data?.total ?? 0,
    isLoading: agentsQuery.isLoading,
    error: agentsQuery.error,
    refetch: agentsQuery.refetch,
    onboardAgent: onboardAgentMutation.mutateAsync,
    isOnboarding: onboardAgentMutation.isPending,
    updateAgent: updateAgentMutation.mutateAsync,
    isUpdating: updateAgentMutation.isPending,
    toggleStatus: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,
    deleteAgent: deleteAgentMutation.mutateAsync,
    isDeleting: deleteAgentMutation.isPending,
    assignChannels: assignChannelsMutation.mutateAsync,
    isAssigningChannels: assignChannelsMutation.isPending,
    assignCampaigns: assignCampaignsMutation.mutateAsync,
    isAssigningCampaigns: assignCampaignsMutation.isPending,
    assignContacts: assignContactsMutation.mutateAsync,
    isAssigningContacts: assignContactsMutation.isPending,
  };
}

export default useAgents;
