import api from "../lib/api";

export const getUnifiedDashboard = async () => {
  const response = await api.get("/api/dashboard");
  return response.data;
};

export const getDashboardOverview = async () => {
  const response = await api.get("/api/dashboard/overview");
  return response.data;
};

export const getCampaigns = async () => {
  const response = await api.get("/api/dashboard/campaigns");
  return response.data;
};

export const getDashboardSummary = async () => {
  const response = await api.get("/api/dashboard/summary");
  return response.data;
};

export const getMessageAnalytics = async () => {
  try {
    const data = await getUnifiedDashboard();
    const s = data?.summary || {};
    const sent = s.sent || s.total_messages || 0;
    const delivered = s.delivered || 0;
    const read = s.read || 0;
    const failed = s.failed || 0;
    return {
      delivery_rate: sent > 0 ? (delivered / sent) * 100 : 0,
      read_rate: delivered > 0 ? (read / delivered) * 100 : 0,
      failure_rate: sent > 0 ? (failed / sent) * 100 : 0,
      ...s,
    };
  } catch {
    return { delivery_rate: 0, read_rate: 0, failure_rate: 0 };
  }
};

export const getTemplateOverview = async () => {
  const response = await api.get("/api/dashboard/template-overview");
  return response.data;
};
