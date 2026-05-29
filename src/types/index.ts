export type UserRole =
  | 'client'
  | 'therapist'
  | 'supervisor'
  | 'hypervisor'
  | 'organizer'
  | 'admin';

export type GroupType = 'therapy' | 'supervision' | 'process';

export type GroupMemberRole = 'participant' | 'linear_trainer' | 'invited_trainer' | 'leader';

export type ConnectionType =
  | 'client_therapist'
  | 'therapist_supervisor'
  | 'process_group';

export type ConnectionStatus = 'pending' | 'confirmed' | 'rejected';

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface Profile {
  id: string;
  access_code: string;
  full_name: string;
  role: UserRole;
  is_active?: boolean;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  landmark: string | null;
  route_hint: string | null;
  photo_url: string | null;
  sort_order: number;
  is_active?: boolean;
}

export interface IntensiveTrainer {
  id: string;
  profile_id: string;
  gestalt_url: string | null;
  full_name: string;
  photo_url: string | null;
  status_line: string | null;
  bio: string | null;
  specializations: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  sort_order: number;
  is_visible: boolean;
  imported_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type GestaltImportPreview = Pick<
  IntensiveTrainer,
  | 'full_name'
  | 'photo_url'
  | 'status_line'
  | 'bio'
  | 'specializations'
  | 'phone'
  | 'email'
  | 'city'
  | 'gestalt_url'
>;

export interface EventDay {
  id: string;
  day_index: number;
  label: string;
  event_date: string | null;
  is_rest_day: boolean;
}

export interface ScheduleEvent {
  id: string;
  event_day_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  venue_id: string | null;
  backup_venue_id: string | null;
  facilitator_id: string | null;
  sort_order: number;
  venue?: Venue | null;
  backup_venue?: Venue | null;
  facilitator?: Profile | null;
}

export interface EventAudience {
  id: string;
  event_id: string;
  target_role: UserRole | null;
  group_id: string | null;
  for_everyone: boolean;
}

export interface Group {
  id: string;
  name: string;
  group_type: GroupType;
  description: string | null;
  venue_id?: string | null;
  meeting_note?: string | null;
  venue?: Venue | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string;
  is_leader: boolean;
  member_role?: GroupMemberRole;
  three_day_block?: number | null;
  profile?: Profile;
}

export interface MyGroupView {
  group: Group;
  myMembership: GroupMember;
  trainers: GroupMember[];
  participants: GroupMember[];
}

export interface Connection {
  id: string;
  connection_type: ConnectionType;
  requester_id: string;
  target_profile_id: string | null;
  target_group_id: string | null;
  status: ConnectionStatus;
  created_at: string;
  confirmed_at: string | null;
  requester?: Profile;
  target_profile?: Profile;
  target_group?: Group;
}

export interface ChatMessage {
  id: string;
  author_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  priority: AnnouncementPriority;
  published_at: string;
  expires_at: string | null;
  is_published: boolean;
}

export interface EventSettings {
  rain_mode: boolean;
  organizer_contact: string;
}

export interface SyncQueueItem {
  id?: number;
  action: 'request_connection' | 'respond_connection';
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'failed';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Клиент',
  therapist: 'Терапевт',
  supervisor: 'Супервизор',
  hypervisor: 'Гипервизор',
  organizer: 'Организатор',
  admin: 'Администратор',
};

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  client_therapist: 'Терапевт',
  therapist_supervisor: 'Супервизор',
  process_group: 'Процесс-группа',
};

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  therapy: 'Терапевтическая группа',
  supervision: 'Супервизионная группа',
  process: 'Процесс-группа',
};

export const GROUP_MEMBER_ROLE_LABELS: Record<GroupMemberRole, string> = {
  participant: 'Участник',
  linear_trainer: 'Линейный тренер',
  invited_trainer: 'Приглашённый тренер',
  leader: 'Ведущий группы',
};

export const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: 'Обычное',
  important: 'Важное',
  urgent: 'Срочное',
};

export function isStaffRole(role: UserRole): boolean {
  return role === 'organizer' || role === 'admin';
}
