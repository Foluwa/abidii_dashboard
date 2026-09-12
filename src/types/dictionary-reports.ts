export interface DictionaryReportItem {
  id: string;
  created_at: string;
  status: string;
  reason: string;
  description?: string | null;

  lemma_id: string;
  word?: string | null;

  reporter_user_id: string;
  reporter_email?: string | null;
  reporter_display_name?: string | null;
}

export interface DictionaryReportListResponse {
  items: DictionaryReportItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
