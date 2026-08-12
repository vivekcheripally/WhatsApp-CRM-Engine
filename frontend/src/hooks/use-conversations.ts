import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import type {
  ConversationListResponse,
  Conversation,
  ConversationStatus,
} from "@/lib/types";

export function useConversations(params?: {
  status?: ConversationStatus;
  search?: string;
  archived?: boolean | null;
  unread?: boolean;
  assigned?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery<ConversationListResponse>({
    queryKey: ["conversations", params],
    queryFn: async () => {
      const { data } = await api.get("/api/conversations", { params });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery<Conversation>({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data } = await api.get(`/api/conversations/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useAssignAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      agentId,
    }: {
      conversationId: string;
      agentId: string | null;
    }) => {
      const { data } = await api.post(
        `/api/conversations/${conversationId}/assign`,
        { assignee_id: agentId }
      );
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (data?.id) {
        qc.invalidateQueries({ queryKey: ["conversation", data.id] });
      }
      toast.success("Conversation assignee updated");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to assign conversation"),
  });
}

export function useClaimConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data } = await api.post(`/api/conversations/${conversationId}/claim`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (data?.id) {
        qc.invalidateQueries({ queryKey: ["conversation", data.id] });
      }
      toast.success("Conversation claimed successfully!");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to claim conversation"),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Conversation> & { id: string }) => {
      const { data } = await api.patch(`/api/conversations/${id}`, updates);
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", data.id], data);
      toast.success("Conversation updated");
    },
    onError: () => toast.error("Failed to update conversation"),
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      archive,
    }: {
      id: string;
      archive: boolean;
    }) => {
      const { data } = await api.patch(`/api/conversations/${id}`, {
        is_archived: archive,
      });
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", data.id], data);
      toast.success(data.is_archived ? "Conversation archived" : "Conversation unarchived");
    },
    onError: () => toast.error("Failed to update archive status"),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/conversations/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.removeQueries({ queryKey: ["conversation", id] });
      toast.success("Conversation deleted");
    },
    onError: () => toast.error("Failed to delete conversation"),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customer_phone: string;
      customer_name?: string;
    }) => {
      const { data } = await api.post("/api/conversations", payload);
      return data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation created");
    },
    onError: () => toast.error("Failed to create conversation"),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data } = await api.post(`/api/conversations/${conversationId}/read`);
      return data as Conversation;
    },
    onSuccess: (conversation) => {
      qc.setQueryData(["conversation", conversation.id], conversation);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Failed to mark conversation as read"),
  });
}

