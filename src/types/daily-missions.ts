export interface MissionCatalogItem {
  id: string;
  kind: string;
  target: number;
  requires_mic: boolean;
}

export interface MissionDayStat {
  mission_id: string;
  assigned: number;
  claims: number;
  bonus: number;
}

export interface MissionDaySummary {
  day: string;
  learners_assigned: number;
  missions_assigned: number;
  claims: number;
  distinct_claimers: number;
  bonus: number;
  missions: MissionDayStat[];
}

export interface MissionSummaryResponse {
  days: number;
  from_day: string;
  catalog: MissionCatalogItem[];
  items: MissionDaySummary[];
}

export interface MissionClaimItem {
  id: string;
  user_id: string;
  user_email?: string | null;
  user_display_name?: string | null;
  mission_day: string;
  mission_id: string;
  progress: number;
  target: number;
  bonus: number;
  claimed_at: string;
}

export interface MissionClaimListResponse {
  items: MissionClaimItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
