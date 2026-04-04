import type {
  AccessMode,
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

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  const maybeJson = response.headers.get("content-type")?.includes("application/json");
  const payload = maybeJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload && String(payload.detail)) ||
      response.statusText ||
      "请求失败";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function login(username: string, password: string): Promise<void> {
  await request<{ message: string; token: string }>("/gallery/login", {
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
  return request<ImageListResponse>(`/gallery/api/list?${search.toString()}`);
}

export async function getStats(): Promise<StatsResponse> {
  return request<StatsResponse>("/gallery/api/stats");
}

export async function logout(): Promise<void> {
  await fetch("/gallery/logout", {
    method: "GET",
    credentials: "include",
  });
}

export async function uploadSingle(file: File, accessMode: AccessMode): Promise<UploadSingleResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("access_mode", accessMode);

  return request<UploadSingleResponse>("/gallery/api/upload", {
    method: "POST",
    body: form,
  });
}

export async function uploadMultiple(files: File[], accessMode: AccessMode): Promise<UploadMultipleResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("access_mode", accessMode);

  return request<UploadMultipleResponse>("/gallery/api/upload/multiple", {
    method: "POST",
    body: form,
  });
}

export async function updateAccessMode(shortcode: string, accessMode: AccessMode, sign = ""): Promise<void> {
  await request<{ message: string }>("/gallery/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortcode, access_mode: accessMode, sign }),
  });
}

export async function deleteImage(shortcode: string): Promise<void> {
  await request<{ message: string }>("/gallery/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortcode }),
  });
}

export async function getImageInfo(shortcode: string, sign = ""): Promise<ImageInfoResponse> {
  const search = new URLSearchParams();
  if (sign) {
    search.set("sign", sign);
  }
  const suffix = search.size ? `?${search.toString()}` : "";
  return request<ImageInfoResponse>(`/gallery/info/${shortcode}${suffix}`);
}

export { ApiError };
