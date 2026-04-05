import type {
  AccessMode,
  CloudBatchResultResponse,
  CloudFileType,
  CloudItem,
  CloudShareAccessResponse,
  CloudListResponse,
  CloudShareResponse,
  CloudSortBy,
  CloudSortOrder,
  CloudSummaryResponse,
  ImageInfoResponse,
  ImageListResponse,
  StatsResponse,
  UploadMultipleResponse,
  UploadSingleResponse,
} from "@/lib/types";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  const maybeJson = response.headers.get("content-type")?.includes("application/json");
  const payload = maybeJson ? await response.json() : null;

  const envelope = payload as ApiEnvelope<T> | null;
  const hasEnvelope =
    envelope !== null &&
    typeof envelope === "object" &&
    "code" in envelope &&
    "data" in envelope &&
    "message" in envelope;

  if (hasEnvelope && typeof envelope.code === "number" && envelope.code !== 0) {
    throw new ApiError(envelope.message || "请求失败", response.status);
  }

  if (!response.ok) {
    const message =
      (hasEnvelope && typeof envelope.message === "string" && envelope.message) ||
      (payload && typeof payload === "object" && "detail" in payload && String(payload.detail)) ||
      response.statusText ||
      "请求失败";
    throw new ApiError(message, response.status);
  }

  if (hasEnvelope) {
    return envelope.data as T;
  }

  return payload as T;
}

export async function login(username: string, password: string): Promise<void> {
  await request<{ message: string; token: string }>("/api/gallery/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function listImages(params: {
  page: number;
  pageSize: number;
  query: string;
  fileType: string;
}): Promise<ImageListResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    query: params.query,
    file_type: params.fileType,
  });
  return request<ImageListResponse>(`/api/gallery/api/list?${search.toString()}`);
}

export async function getStats(): Promise<StatsResponse> {
  return request<StatsResponse>("/api/gallery/api/stats");
}

export async function logout(): Promise<void> {
  await request<{ message: string }>("/api/gallery/logout", {
    method: "GET",
  });
}

export async function uploadSingle(file: File, accessMode: AccessMode): Promise<UploadSingleResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("access_mode", accessMode);

  return request<UploadSingleResponse>("/api/gallery/api/upload", {
    method: "POST",
    body: form,
  });
}

export async function uploadMultiple(files: File[], accessMode: AccessMode): Promise<UploadMultipleResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("access_mode", accessMode);

  return request<UploadMultipleResponse>("/api/gallery/api/upload/multiple", {
    method: "POST",
    body: form,
  });
}

export async function updateAccessMode(shortcode: string, accessMode: AccessMode, sign = ""): Promise<void> {
  await request<{ message: string }>("/api/gallery/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortcode, access_mode: accessMode, sign }),
  });
}

export async function deleteImage(shortcode: string): Promise<void> {
  await request<{ message: string }>("/api/gallery/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortcode }),
  });
}

export async function getImageInfo(shortcode: string, ext: string, sign = ""): Promise<ImageInfoResponse> {
  const search = new URLSearchParams();
  if (sign) {
    search.set("sign", sign);
  }
  const suffix = search.size ? `?${search.toString()}` : "";
  return request<ImageInfoResponse>(`/api/gallery/info/${shortcode}.${ext}${suffix}`);
}

export async function listCloudItems(params: {
  parentId: number | null;
  query: string;
  sortBy: CloudSortBy;
  order: CloudSortOrder;
  fileType: CloudFileType;
}): Promise<CloudListResponse> {
  const search = new URLSearchParams({
    query: params.query,
    sort_by: params.sortBy,
    order: params.order,
    file_type: params.fileType,
  });
  if (params.parentId !== null) {
    search.set("parent_id", String(params.parentId));
  }
  return request<CloudListResponse>(`/api/cloud/items?${search.toString()}`);
}

export async function createCloudFolder(parentId: number | null, name: string): Promise<CloudItem> {
  return request<CloudItem>("/api/cloud/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent_id: parentId, name }),
  });
}

export async function uploadCloudFiles(parentId: number | null, files: File[]): Promise<CloudItem[]> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const search = new URLSearchParams();
  if (parentId !== null) {
    search.set("parent_id", String(parentId));
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  const payload = await request<{ items: CloudItem[] }>(`/api/cloud/upload/multiple${suffix}`, {
    method: "POST",
    body: form,
  });
  return payload.items;
}

export async function renameCloudItem(itemId: number, name: string): Promise<CloudItem> {
  return request<CloudItem>(`/api/cloud/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteCloudItem(itemId: number): Promise<void> {
  await request<{ message: string }>(`/api/cloud/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function moveCloudItem(itemId: number, targetParentId: number | null): Promise<CloudItem> {
  return request<CloudItem>(`/api/cloud/items/${itemId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_parent_id: targetParentId }),
  });
}

export async function copyCloudItem(itemId: number, targetParentId: number | null, name?: string): Promise<CloudItem> {
  return request<CloudItem>(`/api/cloud/items/${itemId}/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_parent_id: targetParentId, name }),
  });
}

export async function batchDeleteCloudItems(itemIds: number[]): Promise<CloudBatchResultResponse> {
  return request<CloudBatchResultResponse>("/api/cloud/items/batch/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

export async function batchMoveCloudItems(itemIds: number[], targetParentId: number | null): Promise<CloudBatchResultResponse> {
  return request<CloudBatchResultResponse>("/api/cloud/items/batch/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds, target_parent_id: targetParentId }),
  });
}

export async function batchCopyCloudItems(itemIds: number[], targetParentId: number | null): Promise<CloudBatchResultResponse> {
  return request<CloudBatchResultResponse>("/api/cloud/items/batch/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds, target_parent_id: targetParentId }),
  });
}

export async function getCloudSummary(): Promise<CloudSummaryResponse> {
  return request<CloudSummaryResponse>("/api/cloud/summary");
}

export async function createCloudShare(payload: {
  itemId: number;
  password?: string;
  expiresMinutes?: number;
}): Promise<CloudShareResponse> {
  return request<CloudShareResponse>("/api/cloud/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: payload.itemId,
      password: payload.password ?? "",
      expires_minutes: payload.expiresMinutes,
    }),
  });
}

export async function listCloudShares(): Promise<CloudShareResponse[]> {
  return request<CloudShareResponse[]>("/api/cloud/shares");
}

export async function cancelCloudShare(shareId: number): Promise<void> {
  await request<{ message: string }>(`/api/cloud/shares/${shareId}`, {
    method: "DELETE",
  });
}

export async function accessCloudShare(shareCode: string, password = ""): Promise<CloudShareAccessResponse> {
  return request<CloudShareAccessResponse>(`/api/cloud/public/${shareCode}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export { ApiError };
