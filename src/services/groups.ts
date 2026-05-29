import { supabase } from '@/lib/supabase/client';
import type { Group, GroupMember, GroupMemberRole, MyGroupView, Venue } from '@/types';

type MemberRow = GroupMember & {
  profile: { id: string; full_name: string; role: string } | null;
};

type GroupRow = Group & {
  venue: Venue | null;
};

function isTrainerRole(role?: GroupMemberRole): boolean {
  return role === 'linear_trainer' || role === 'invited_trainer' || role === 'leader';
}

export async function fetchMyGroups(profileId: string): Promise<MyGroupView[]> {
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select('id, group_id, profile_id, is_leader, member_role, three_day_block')
    .eq('profile_id', profileId);

  if (mErr) throw mErr;
  if (!memberships?.length) return [];

  const groupIds = memberships.map((m) => m.group_id);

  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, name, group_type, description, venue_id, meeting_note, venue:venues(id, name, landmark, route_hint)')
    .in('id', groupIds);

  if (gErr) throw gErr;

  const { data: allMembers, error: aErr } = await supabase
    .from('group_members')
    .select('id, group_id, profile_id, is_leader, member_role, three_day_block, profile:profiles(id, full_name, role)')
    .in('group_id', groupIds);

  if (aErr) throw aErr;

  const membersByGroup = new Map<string, MemberRow[]>();
  for (const row of allMembers ?? []) {
    const raw = row as MemberRow & {
      profile?: MemberRow['profile'] | MemberRow['profile'][] | null;
    };
    const profile = Array.isArray(raw.profile) ? raw.profile[0] ?? null : raw.profile ?? null;
    const r = { ...raw, profile } as MemberRow;
    const list = membersByGroup.get(r.group_id) ?? [];
    list.push(r);
    membersByGroup.set(r.group_id, list);
  }

  const views: MyGroupView[] = [];

  for (const m of memberships) {
    const rawGroup = (groups ?? []).find((g) => g.id === m.group_id) as GroupRow & {
      venue?: Venue | Venue[] | null;
    };
    if (!rawGroup) continue;
    const venue = Array.isArray(rawGroup.venue) ? rawGroup.venue[0] ?? null : rawGroup.venue ?? null;
    const group = { ...rawGroup, venue } as GroupRow;
    const members = membersByGroup.get(m.group_id) ?? [];
    const trainers = members.filter((x) => isTrainerRole(x.member_role as GroupMemberRole));
    const participants = members.filter(
      (x) => (x.member_role ?? 'participant') === 'participant',
    );

    views.push({
      group,
      myMembership: m as GroupMember,
      trainers,
      participants,
    });
  }

  views.sort((a, b) => a.group.name.localeCompare(b.group.name, 'ru'));
  return views;
}

export function formatGroupMeetingPlace(group: Group): string | null {
  if (group.venue) {
    const parts = [group.venue.name];
    if (group.venue.landmark) parts.push(group.venue.landmark);
    return parts.join(' · ');
  }
  if (group.meeting_note?.trim()) return group.meeting_note.trim();
  return null;
}

export function formatTrainerLine(member: GroupMember): string {
  const name = member.profile?.full_name ?? '—';
  const role = member.member_role ?? (member.is_leader ? 'leader' : 'participant');
  const roleLabel =
    role === 'invited_trainer' && member.three_day_block
      ? `Приглашённый тренер (${member.three_day_block}-я трёхдневка)`
      : role === 'linear_trainer'
        ? 'Линейный тренер'
        : role === 'leader'
          ? 'Ведущий'
          : role === 'invited_trainer'
            ? 'Приглашённый тренер'
            : '';
  return roleLabel ? `${name} — ${roleLabel}` : name;
}
