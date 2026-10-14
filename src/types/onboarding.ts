/**
 * Onboarding admin: social-proof reviews, "How did you hear about Abidii"
 * options, and the acquisition analytics built from the answers.
 *
 * Contract: /api/v1/admin/onboarding/* and /api/v1/admin/analytics/acquisition.
 */

export const ONBOARDING_LANGUAGES = ['en', 'fr', 'es', 'pt', 'yo'] as const;
export type OnboardingLanguage = (typeof ONBOARDING_LANGUAGES)[number];

export const ONBOARDING_LANGUAGE_LABELS: Record<OnboardingLanguage, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  yo: 'Yorùbá',
};

export const REVIEW_SOURCES = ['app_store', 'google_play', 'direct'] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  app_store: 'App Store',
  google_play: 'Google Play',
  direct: 'Direct (email, message, in person)',
};

export const REVIEW_TEXT_MAX = 400;

export interface OnboardingReview {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  rating: number;
  text: string;
  language: OnboardingLanguage;
  translated: boolean;
  enabled: boolean;
  sort_order: number;
  source: ReviewSource;
  permission_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export type OnboardingReviewInput = Omit<OnboardingReview, 'id' | 'created_at' | 'updated_at'>;

export type AcquisitionLabels = Record<OnboardingLanguage, string>;

export interface AcquisitionOption {
  key: string;
  labels: AcquisitionLabels;
  icon: string;
  image_url: string | null;
  enabled: boolean;
  sort_order: number;
}

/** The catch-all option: the app needs it, so it can't be deleted. */
export const ACQUISITION_OTHER_KEY = 'other';

export interface AcquisitionSourceCount {
  source: string;
  count: number;
}

export interface AcquisitionCountryCount {
  country: string | null;
  source: string;
  count: number;
}

export interface AcquisitionDayCount {
  date: string;
  source: string;
  count: number;
}

export interface AcquisitionOtherText {
  text: string;
  count: number;
}

export interface AcquisitionAnalyticsResponse {
  total_answered: number;
  total_signups: number;
  by_source: AcquisitionSourceCount[];
  by_country: AcquisitionCountryCount[];
  over_time: AcquisitionDayCount[];
  other_texts: AcquisitionOtherText[];
}

/** Translations of a sign-in word's meaning. English is required. */
export const SIGNIN_WORD_MEANING_LANGUAGES = ['en', 'fr', 'es', 'pt'] as const;
export type SigninWordMeaningLanguage = (typeof SIGNIN_WORD_MEANING_LANGUAGES)[number];

export type SigninWordMeanings = { en: string } & Partial<Record<Exclude<SigninWordMeaningLanguage, 'en'>, string | null>>;

export const SIGNIN_WORD_YORUBA_MAX = 40;
export const SIGNIN_WORD_MEANING_MAX = 60;
/** The app shows at most this many enabled words on the sign-in screen. */
export const SIGNIN_WORDS_APP_LIMIT = 8;

/** A short positive Yorùbá word floating as a pill on the app's sign-in screen. */
export interface SigninWord {
  id: string;
  yoruba: string;
  meanings: SigninWordMeanings;
  /** Word-library term this was picked from (its audio is reused). */
  term_id: string | null;
  /** Manual audio override: a URL or a storage key. */
  audio_url: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Read-only: the playable audio URL (override, else the term's audio). */
  resolved_audio_url: string | null;
}

export type SigninWordInput = Pick<SigninWord, 'yoruba' | 'meanings' | 'term_id' | 'audio_url' | 'enabled' | 'sort_order'>;

/** A word-library match from the term search. */
export interface SigninWordTermMatch {
  term_id: string;
  yoruba: string;
  gloss_en: string | null;
  audio_url: string | null;
}
