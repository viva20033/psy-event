export type UserRole =
  | 'client'
  | 'therapist'
  | 'supervisor'
  | 'hypervisor'
  | 'organizer'
  | 'admin';

export type GroupType = 'therapy' | 'supervision' | 'process';

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
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string;
  is_leader: boolean;
  profile?: Profile;
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

export const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: 'Обычное',
  important: 'Важное',
  urgent: 'Срочное',
};

export function isStaffRole(role: UserRole): boolean {
  return role === 'organizer' || role === 'admin';
}
