import api from "../lib/api";

type CampaignPayload = Record<string, unknown>;

export const createCampaign = async (data: CampaignPayload) => {
  const response = await api.post("/api/campaign/create-campaign", data);
  return response.data;
};

export const getCampaign = async (id: string | number) => {
  const response = await api.get(`/api/campaign/${id}`);
  return response.data;
};

export const getCampaignAnalytics = async (id: string | number) => {
  const response = await api.get(`/api/campaign/${id}/analytics`);
  return response.data;
};

export const getCampaignDetails = async (id: string | number) => {
  try {
    const response = await api.get(`/api/campaign/details/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching campaign details:", error);
    return { success: false, error: error?.response?.data?.detail || error.message };
  }
};

export const updateCampaign = async (id: string | number, data: CampaignPayload) => {
  try {
    const response = await api.put(`/api/campaign/update/${id}`, data);
    return response.data;
  } catch (error: any) {
    console.error("Error updating campaign:", error);
    return { success: false, error: error?.response?.data?.detail || error.message };
  }
};

export const listCampaigns = async () => {
  try {
    const response = await api.get("/api/campaign/list");
    return response.data;
  } catch (error: any) {
    console.error("Error fetching campaigns:", error);
    return { success: false, campaigns: [], error: error?.response?.data?.detail || error.message };
  }
};

export const runCampaign = async (campaignId: string | number) => {
  const response = await api.post("/api/campaign/run-campaign", { campaign_id: campaignId });
  return response.data;
};

export const deleteCampaign = async (id: string | number) => {
  try {
    const response = await api.delete(`/api/campaign/delete/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    return { success: false, error: error?.response?.data?.detail || error.message };
  }
};

export const getCampaignRecipients = async (id: string | number) => {
  const response = await api.get(`/api/campaign/${id}/recipients`);
  return response.data;
};
