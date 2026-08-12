import api from "../lib/api";

type ContactQuery = {
  q?: string;
  status?: string;
  source?: string;
};

type ContactPayload = {
  name: string;
  phone: string;
  email?: string;
  status?: string;
  source?: string;
};

export const getContacts = async ({ q, status, source }: ContactQuery = {}) => {
  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (status && status.toLowerCase() !== "all") params.status = status;
  if (source && source.toLowerCase() !== "all") params.source = source;
  const response = await api.get("/api/contacts", { params });
  return response.data;
};

export const createContact = async (contact: ContactPayload) => {
  const response = await api.post("/api/contacts/create", {
    name: contact.name,
    phone_number: contact.phone,
    email: contact.email,
    status: contact.status || "ACTIVE",
    source: contact.source || "MANUAL",
  });
  return response.data;
};

export const updateContact = async (id: string | number, contact: ContactPayload) => {
  const response = await api.put(`/api/contacts/${id}`, {
    name: contact.name,
    phone_number: contact.phone,
    email: contact.email,
    status: contact.status || "ACTIVE",
    source: contact.source,
  });
  return response.data;
};

export const importContacts = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/api/contacts/import", formData);
  return response.data;
};

export const deleteContactApi = async (id: string | number) => {
  const response = await api.delete(`/api/contacts/${id}`);
  return response.data;
};

export const bulkAssignContacts = async (contactIds: string[], ownerId: string) => {
  const response = await api.post("/api/contacts/assign", {
    contact_ids: contactIds,
    owner_id: ownerId,
  });
  return response.data;
};
