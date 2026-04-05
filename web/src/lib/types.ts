export type AccessMode = "none" | "individual";

export interface UploadResultItem {
  file_name: string;
  success: boolean;
  file_size?: number;
  file_type?: string;
  short_code?: string;
  view_url?: string;
  direct_url?: string;
  preview_url?: string;
  download_url?: string;
  sign?: string | null;
  error?: string;
}

export interface UploadMultipleResponse {
  total: number;
  results: UploadResultItem[];
}

export interface UploadSingleResponse {
  short_code: string;
  file_name: string;
  file_size: number;
  file_type: string;
  width: number;
  height: number;
  view_url: string;
  direct_url: string;
  preview_url: string;
  download_url: string;
  sign?: string | null;
}

export interface ImageListItem {
  id: number;
  short_code: string;
  file_name: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  width: number;
  height: number;
  view_count: number;
  download_count: number;
  view_url: string;
  direct_url: string;
  preview_url: string;
  download_url: string;
  access_mode: AccessMode;
  sign?: string | null;
  created_at: string;
}

export interface ImageListResponse {
  total: number;
  page: number;
  items: ImageListItem[];
}

export interface StatsResponse {
  total_images: number;
  total_size: number;
  total_views: number;
  total_downloads: number;
  today_views: number;
  today_uploads: number;
  top_images: Array<{
    short_code: string;
    file_name: string;
    file_type: string;
    view_count: number;
  }>;
  top_refers: Array<{
    referer: string;
    count: number;
  }>;
  top_origins: Array<{
    origin_ip: string;
    count: number;
  }>;
  daily_stats: Array<{
    date: string;
    views: number;
    downloads: number;
    uploads: number;
  }>;
}

export interface ImageInfoResponse {
  short_code: string;
  file_name: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  width: number;
  height: number;
  view_count: number;
  download_count: number;
  created_at: string;
}

export type CloudSortBy = "name" | "time" | "size";
export type CloudSortOrder = "asc" | "desc";
export type CloudFileType = "all" | "image" | "video" | "audio" | "document" | "other";

export interface CloudItem {
  id: number;
  parent_id: number | null;
  name: string;
  is_folder: boolean;
  file_size: number;
  mime_type: string;
  file_ext: string;
  is_public: boolean;
  duplicate_of_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CloudListResponse {
  parent_id: number | null;
  items: CloudItem[];
}

export interface CloudSummaryResponse {
  total_items: number;
  total_files: number;
  total_folders: number;
  total_size: number;
  total_space: number;
  available_space: number;
  recent_uploads: CloudItem[];
  recent_top_visits: Array<{
    item_id: number;
    item_name: string;
    visit_count: number;
    last_accessed_at: string | null;
  }>;
}

export interface CloudShareResponse {
  id: number;
  item_id: number;
  item_name: string;
  share_code: string;
  has_password: boolean;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  share_url: string;
}

export interface CloudShareAccessResponse {
  share_code: string;
  item: CloudItem;
  preview_url: string;
  download_url: string;
}

export interface CloudBatchResultResponse {
  total: number;
  success: number;
  failed: number;
  message: string;
}
