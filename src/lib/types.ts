/* Types matching the Supabase database schema */

export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'suspended' | 'banned';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type ActivityType = 'quiz' | 'flashcard' | 'matching' | 'picture' | 'dragndrop';
export type PlayMode = 'practice' | 'competitive';
export type PrivacySetting = 'public' | 'private';
export type AuditAction = 'create' | 'update' | 'delete';
export type SchoolStatus = 'active' | 'inactive';

export interface School {
  id: string;
  name: string;
  address: string | null;
  status: SchoolStatus;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  school_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  class_id: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  subject_id: string;
  sort_order: number;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: UserRole | null;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  school_id: string | null;
  class_id: string | null;
  avatar_url: string | null;
  privacy: PrivacySetting;
  status: UserStatus;
  verification_status: VerificationStatus | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  subjects_claimed: string[] | null;
  auth_provider: string | null;
  points: number;
  title: string | null;
  milestone: string | null;
  daily_xp_earned?: number;
  last_xp_earned_date?: string | null;
  created_at: string;
  updated_at: string;
}

/* Quiz payload */
export interface QuizPayload {
  question: string;
  options: string[];
  correct_answer: number; // index of correct option
  hint?: string;
  explanation?: string;
}

/* Flashcard payload */
export interface FlashcardPayload {
  front: string;
  back: string;
}

/* Matching payload */
export interface MatchingPayload {
  pairs: { left: string; right: string }[];
}

/* Picture Game payload */
export interface PicturePayload {
  image_url: string;
  question: string;
  options: string[];
  correct_answer: number;
}

/* Drag & Drop payload */
export interface DragndropPayload {
  sentence: string;
  answers: string[];
}

export type ContentPayload = QuizPayload | FlashcardPayload | MatchingPayload | PicturePayload | DragndropPayload;

export interface Content {
  id: string;
  chapter_id: string;
  activity_type: ActivityType;
  payload: ContentPayload;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityAttempt {
  id: string;
  user_id: string;
  chapter_ids: string[];
  activity_type: ActivityType;
  mode: PlayMode;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  points_earned: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  teacher_id: string;
  action_type: AuditAction;
  target_table: string;
  target_id: string | null;
  description: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export type ActivityZone = 'play' | 'test';

export interface Activity {
  id: string;
  key: string;
  label: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  zone: ActivityZone;
  sort_order: number;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  school_id: string | null;
  class_id: string | null;
  privacy: PrivacySetting;
  points: number;
  total_score: number;
  total_activities: number;
  school_rank: number;
  global_rank: number;
}
