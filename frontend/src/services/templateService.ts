import api from "../lib/api";

type TemplatePayload = Record<string, unknown>;

export const getTemplates = async () => {
  try {
    const response = await api.get("/api/templates");
    return response.data;
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
};

export const syncAllTemplates = async () => {
  try {
    const response = await api.post("/api/templates/sync-all");
    return response.data;
  } catch (error) {
    console.error("Error syncing all templates:", error);
    throw error;
  }
};

export const createTemplate = async (template: TemplatePayload | FormData) => {
  try {
    const response = await api.post("/api/templates/create", template);
    return response.data;
  } catch (error: any) {
    console.error("Error creating template:", error);
    throw new Error(error?.response?.data?.detail || "Template creation failed");
  }
};

export const updateTemplate = async (id: string | number, template: TemplatePayload) => {
  try {
    const response = await api.put(`/api/templates/${id}`, template);
    return response.data;
  } catch (error: any) {
    console.error("Error updating template:", error);
    throw new Error(error?.response?.data?.detail || "Failed to update template");
  }
};

export const deleteTemplate = async (id: string | number) => {
  try {
    const response = await api.delete(`/api/templates/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting template:", error);
    throw new Error(error?.response?.data?.detail || "Failed to delete template");
  }
};

export const syncTemplateStatus = async (id: string | number) => {
  try {
    const response = await api.post(`/api/templates/${id}/sync-status`);
    return response.data;
  } catch (error) {
    console.error("Error syncing template status:", error);
    throw error;
  }
};

export const resubmitTemplate = async (id: string | number) => {
  try {
    const response = await api.post(`/api/templates/${id}/resubmit`);
    return response.data;
  } catch (error: any) {
    console.error("Error resubmitting template:", error);
    throw new Error(error?.response?.data?.detail || "Resubmit failed");
  }
};

export const getRecentActivities = async (limit = 5) => {
  try {
    const response = await api.get(`/api/templates/activity/recent?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    throw error;
  }
};
