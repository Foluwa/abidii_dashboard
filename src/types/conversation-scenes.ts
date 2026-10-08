export type ConversationVerdict = 'correct' | 'acceptable' | 'wrong';

export interface ConversationLineNode {
  id: string;
  type: 'line';
  speaker?: string | null;
  yorubaText?: string | null;
  englishText?: string | null;
  audioUrl?: string | null;
  next?: string | null;
}

export interface ConversationReplyOption {
  id: string;
  verdict?: ConversationVerdict | string | null;
  yorubaText?: string | null;
  englishText?: string | null;
  audioUrl?: string | null;
  correction?: string | null;
  next?: string | null;
}

export interface ConversationChoiceNode {
  id: string;
  type: 'choice';
  prompt?: string | null;
  options?: ConversationReplyOption[] | null;
}

export interface ConversationEndNode {
  id: string;
  type: 'end';
  message?: string | null;
}

export type ConversationNode = ConversationLineNode | ConversationChoiceNode | ConversationEndNode;

export interface ConversationScenario {
  id?: string;
  version?: number;
  title?: string | null;
  context?: string | null;
  imageUrl?: string | null;
  reviewed?: boolean;
  reviewNotes?: string[] | null;
  startNodeId?: string;
  nodes?: ConversationNode[] | null;
}

export interface ConversationSceneListItem {
  blueprint_key: string;
  lesson_title?: string | null;
  lesson_status?: string | null;
  lesson_enabled: boolean;
  updated_at?: string | null;
  step_index: number;
  scene_id?: string | null;
  version?: number | null;
  title?: string | null;
  reviewed: boolean;
  review_notes_count: number;
  node_count: number;
  line_count: number;
  choice_count: number;
  reply_count: number;
  end_count: number;
  audio_count: number;
  missing_audio_count: number;
  problems: string[];
}

export interface ConversationSceneListResponse {
  items: ConversationSceneListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ConversationSceneDetail extends ConversationSceneListItem {
  scenario: ConversationScenario;
}
