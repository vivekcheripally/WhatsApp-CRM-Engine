import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Broadcast {
  id: string;
  company_id?: string;
  name: string;
  message?: string;
  recipients: string[];
  status: string;
  scheduled_at?: string | null;
  sent_count: number;
  failed_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface BroadcastCreate {
  name: string;
  message: string;
  recipients: string[];
  template_id?: string;
  scheduled_at?: string;
}

export interface BroadcastUpdate {
  name?: string;
  message?: string;
  recipients?: string[];
  template_id?: string;
  scheduled_at?: string | null;
}

export function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/api/campaign/list");
        const list = Array.isArray(data) ? data : data?.campaigns || [];
        return list.map((c: any) => ({
          id: String(c.id),
          name: c.campaign_name || c.name || "Campaign",
          message: c.template_name || c.message || "",
          recipients: c.recipients || [],
          status: c.status || "DRAFT",
          sent_count: c.delivered || c.sent_count || 0,
          failed_count: c.failed || c.failed_count || 0,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
      } catch (err) {
        console.error("Error fetching campaigns/broadcasts:", err);
        return [];
      }
    },
    staleTime: 5000,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BroadcastCreate) => {
      // Create campaign using campaign service endpoint
      const { data } = await api.post("/api/campaign/create-campaign", {
        campaign_name: payload.name,
        template_id: payload.template_id || "",
        contact_ids: payload.recipients || [],
        schedule_time: payload.scheduled_at,
      });
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BroadcastUpdate }) => {
      const { data } = await api.put(`/api/campaign/update/${id}`, {
        campaign_name: payload.name,
        template_id: payload.template_id,
        contact_ids: payload.recipients,
      });
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useDeleteBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/campaign/delete/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post("/api/campaign/run-campaign", {
        campaign_id: id,
      });
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
