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
