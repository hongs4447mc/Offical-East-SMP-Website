create table if not exists public.staff_roles (
	user_id uuid not null references auth.users(id) on delete cascade,
	role text not null check (role in ('owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager')),
	assigned_by uuid references auth.users(id) on delete set null,
	assigned_at timestamptz not null default now(),
	primary key (user_id, role)
);

create table if not exists public.community_players (
	id uuid primary key default gen_random_uuid(),
	minecraft_name text not null unique,
	minecraft_uuid text unique,
	notes text not null default '',
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.moderation_cases (
	id uuid primary key default gen_random_uuid(),
	player_id uuid not null references public.community_players(id) on delete restrict,
	action text not null check (action in ('warning', 'ban')),
	reason text not null,
	expires_at timestamptz,
	status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now()
);

create table if not exists public.community_announcements (
	id uuid primary key default gen_random_uuid(),
	title text not null,
	body text not null,
	published boolean not null default false,
	published_at timestamptz,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.community_events (
	id uuid primary key default gen_random_uuid(),
	title text not null,
	description text not null default '',
	rules text not null default '',
	category text not null default 'community' check (category in ('community', 'pvp', 'building', 'survival', 'special', 'maintenance')),
	banner_url text,
	starts_at timestamptz not null,
	ends_at timestamptz,
	host text not null default '',
	location text not null default '',
	coordinates text not null default '',
	requirements text not null default '',
	capacity integer check (capacity is null or capacity > 0),
	registration_open boolean not null default true,
	participant_count integer not null default 0,
	results text not null default '',
	published boolean not null default false,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (ends_at is null or ends_at >= starts_at)
);

alter table public.community_events
	add column if not exists rules text not null default '',
	add column if not exists category text not null default 'community' check (category in ('community', 'pvp', 'building', 'survival', 'special', 'maintenance')),
	add column if not exists banner_url text,
	add column if not exists host text not null default '',
	add column if not exists location text not null default '',
	add column if not exists coordinates text not null default '',
	add column if not exists requirements text not null default '',
	add column if not exists capacity integer check (capacity is null or capacity > 0),
	add column if not exists registration_open boolean not null default true,
	add column if not exists participant_count integer not null default 0,
	add column if not exists results text not null default '';

create table if not exists public.community_event_participants (
	id uuid primary key default gen_random_uuid(),
	event_id uuid not null references public.community_events(id) on delete cascade,
	minecraft_name text not null,
	added_by uuid references auth.users(id) on delete set null,
	added_at timestamptz not null default now(),
	check (length(btrim(minecraft_name)) between 1 and 16)
);

create unique index if not exists community_event_participants_name_per_event
	on public.community_event_participants (event_id, lower(minecraft_name));

create table if not exists public.community_polls (
	id uuid primary key default gen_random_uuid(),
	title text not null,
	description text not null default '',
	is_open boolean not null default false,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.community_poll_options (
	id uuid primary key default gen_random_uuid(),
	poll_id uuid not null references public.community_polls(id) on delete cascade,
	label text not null,
	sort_order integer not null default 0,
	unique (poll_id, id),
	unique (poll_id, label)
);

create table if not exists public.community_poll_votes (
	poll_id uuid not null references public.community_polls(id) on delete cascade,
	voter_id uuid not null,
	option_id uuid not null,
	created_at timestamptz not null default now(),
	primary key (poll_id, voter_id),
	foreign key (poll_id, option_id)
		references public.community_poll_options(poll_id, id)
		on delete cascade
);

create table if not exists public.community_profiles (
	id uuid primary key default gen_random_uuid(),
	player_id uuid not null unique references public.community_players(id) on delete cascade,
	display_name text not null,
	bio text not null default '',
	avatar_url text,
	is_public boolean not null default false,
	updated_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
	id bigint generated always as identity primary key,
	actor_id uuid references auth.users(id) on delete set null,
	table_name text not null,
	operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
	record_key text,
	old_data jsonb,
	new_data jsonb,
	occurred_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;

create or replace function public.has_staff_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.staff_roles
		where user_id = auth.uid()
			and role = any(required_roles)
	);
$$;

revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to anon, authenticated;

alter table public.staff_roles enable row level security;
alter table public.community_players enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_events enable row level security;
alter table public.community_event_participants enable row level security;
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.community_profiles enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on table public.staff_roles, public.community_players, public.moderation_cases,
	public.community_announcements, public.community_events, public.community_polls,
	public.community_event_participants,
	public.community_poll_options, public.community_poll_votes, public.community_profiles,
	public.admin_audit_logs from public, anon, authenticated;

grant select on public.staff_roles to authenticated;
grant select, insert, update, delete on public.community_players to authenticated;
grant select, insert, update, delete on public.moderation_cases to authenticated;
grant select on public.community_announcements, public.community_events to anon, authenticated;
grant insert, update, delete on public.community_announcements, public.community_events to authenticated;
grant select, delete on public.community_event_participants to authenticated;
grant select, insert, update, delete on public.community_polls, public.community_poll_options to authenticated;
grant select on public.community_profiles to anon, authenticated;
grant insert, update, delete on public.community_profiles to authenticated;
grant select on public.admin_audit_logs to authenticated;

drop policy if exists "staff can read own roles" on public.staff_roles;
create policy "staff can read own roles" on public.staff_roles
	for select to authenticated
	using (user_id = auth.uid() or public.has_staff_role(array['owner']));

drop policy if exists "owners view all staff roles" on public.staff_roles;
create policy "owners view all staff roles" on public.staff_roles
	for select to authenticated
	using (public.has_staff_role(array['owner']));

drop policy if exists "staff manage community players" on public.community_players;
create policy "staff manage community players" on public.community_players
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator', 'moderator']))
	with check (public.has_staff_role(array['owner', 'administrator', 'moderator']));

drop policy if exists "staff manage moderation cases" on public.moderation_cases;
create policy "staff manage moderation cases" on public.moderation_cases
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator', 'moderator']))
	with check (public.has_staff_role(array['owner', 'administrator', 'moderator']));

drop policy if exists "public and staff read announcements" on public.community_announcements;
create policy "public and staff read announcements" on public.community_announcements
	for select to anon, authenticated
	using (
		published
		or public.has_staff_role(array['owner', 'administrator', 'announcement_manager'])
	);

drop policy if exists "announcement staff manage announcements" on public.community_announcements;
create policy "announcement staff manage announcements" on public.community_announcements
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator', 'announcement_manager']))
	with check (public.has_staff_role(array['owner', 'administrator', 'announcement_manager']));

drop policy if exists "public and staff read events" on public.community_events;
create policy "public and staff read events" on public.community_events
	for select to anon, authenticated
	using (
		published
		or public.has_staff_role(array['owner', 'administrator', 'event_manager'])
	);

drop policy if exists "event staff manage events" on public.community_events;
create policy "event staff manage events" on public.community_events
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator', 'event_manager']))
	with check (public.has_staff_role(array['owner', 'administrator', 'event_manager']));

drop policy if exists "event staff manage participants" on public.community_event_participants;
create policy "event staff manage participants" on public.community_event_participants
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator', 'event_manager']))
	with check (public.has_staff_role(array['owner', 'administrator', 'event_manager']));

drop policy if exists "public and staff read polls" on public.community_polls;
create policy "public and staff read polls" on public.community_polls
	for select to anon, authenticated
	using (is_open or public.has_staff_role(array['owner', 'administrator']));

drop policy if exists "administrators manage polls" on public.community_polls;
create policy "administrators manage polls" on public.community_polls
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator']))
	with check (public.has_staff_role(array['owner', 'administrator']));

drop policy if exists "public and staff read poll options" on public.community_poll_options;
create policy "public and staff read poll options" on public.community_poll_options
	for select to anon, authenticated
	using (
		exists (
			select 1 from public.community_polls
			where id = poll_id and (is_open or public.has_staff_role(array['owner', 'administrator']))
		)
	);

drop policy if exists "administrators manage poll options" on public.community_poll_options;
create policy "administrators manage poll options" on public.community_poll_options
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator']))
	with check (public.has_staff_role(array['owner', 'administrator']));

drop policy if exists "public and staff read profiles" on public.community_profiles;
create policy "public and staff read profiles" on public.community_profiles
	for select to anon, authenticated
	using (is_public or public.has_staff_role(array['owner', 'administrator']));

drop policy if exists "administrators manage profiles" on public.community_profiles;
create policy "administrators manage profiles" on public.community_profiles
	for all to authenticated
	using (public.has_staff_role(array['owner', 'administrator']))
	with check (public.has_staff_role(array['owner', 'administrator']));

drop policy if exists "administrators read audit logs" on public.admin_audit_logs;
create policy "administrators read audit logs" on public.admin_audit_logs
	for select to authenticated
	using (public.has_staff_role(array['owner', 'administrator']));

create or replace function public.assign_staff_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null or not public.has_staff_role(array['owner']) then
		raise exception 'Only an Owner can assign staff roles.' using errcode = '42501';
	end if;
	if p_user_id is null or p_role is null or p_role not in ('owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager') then
		raise exception 'Invalid staff role assignment.' using errcode = '22023';
	end if;

	insert into public.staff_roles (user_id, role, assigned_by)
	values (p_user_id, p_role, auth.uid())
	on conflict (user_id, role) do update
	set assigned_by = excluded.assigned_by,
		assigned_at = pg_catalog.now();
end;
$$;

create or replace function public.revoke_staff_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null or not public.has_staff_role(array['owner']) then
		raise exception 'Only an Owner can revoke staff roles.' using errcode = '42501';
	end if;
	if p_user_id is null or p_role is null or p_role not in ('owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager') then
		raise exception 'Invalid staff role assignment.' using errcode = '22023';
	end if;
	lock table public.staff_roles in share row exclusive mode;
	if not public.has_staff_role(array['owner']) then
		raise exception 'Only an Owner can revoke staff roles.' using errcode = '42501';
	end if;
	if p_role = 'owner' and (
		select pg_catalog.count(*) from public.staff_roles where role = 'owner'
	) <= 1 then
		raise exception 'The last Owner role cannot be revoked.' using errcode = '23514';
	end if;

	delete from public.staff_roles where user_id = p_user_id and role = p_role;
end;
$$;

create or replace function public.change_staff_role(p_user_id uuid, p_old_role text, p_new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'Only an Owner can change staff roles.' using errcode = '42501';
	end if;
	if p_user_id is null
		or p_old_role is null
		or p_new_role is null
		or p_old_role not in ('owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager')
		or p_new_role not in ('owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager')
		or p_old_role = p_new_role then
		raise exception 'Choose a different valid staff role.' using errcode = '22023';
	end if;

	lock table public.staff_roles in share row exclusive mode;
	if not public.has_staff_role(array['owner']) then
		raise exception 'Only an Owner can change staff roles.' using errcode = '42501';
	end if;
	if not exists (
		select 1 from public.staff_roles where user_id = p_user_id and role = p_old_role
	) then
		raise exception 'The selected role is no longer assigned to this user.' using errcode = 'P0002';
	end if;
	if p_old_role = 'owner' and (
		select pg_catalog.count(*) from public.staff_roles where role = 'owner'
	) <= 1 then
		raise exception 'The last Owner role cannot be changed.' using errcode = '23514';
	end if;

	insert into public.staff_roles (user_id, role, assigned_by)
	values (p_user_id, p_new_role, auth.uid())
	on conflict (user_id, role) do update
	set assigned_by = excluded.assigned_by,
		assigned_at = pg_catalog.now();

	delete from public.staff_roles where user_id = p_user_id and role = p_old_role;
end;
$$;

create or replace function public.update_community_event_participant_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		update public.community_events
		set participant_count = participant_count + 1,
			updated_at = pg_catalog.now()
		where id = new.event_id;
		return new;
	end if;

	update public.community_events
	set participant_count = case when participant_count > 0 then participant_count - 1 else 0 end,
		updated_at = pg_catalog.now()
	where id = old.event_id;
	return old;
end;
$$;

revoke all on function public.update_community_event_participant_count() from public, anon, authenticated;
drop trigger if exists update_event_participant_count on public.community_event_participants;
create trigger update_event_participant_count
	after insert or delete on public.community_event_participants
	for each row execute function public.update_community_event_participant_count();

create or replace function public.add_community_event_participant(p_event_id uuid, p_minecraft_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	event_capacity integer;
	event_participant_count integer;
	event_registration_open boolean;
	normalized_name text := pg_catalog.btrim(p_minecraft_name);
begin
	if auth.uid() is null or not public.has_staff_role(array['owner', 'administrator', 'event_manager']) then
		raise exception 'Only event staff can manage participants.' using errcode = '42501';
	end if;
	if p_event_id is null or normalized_name is null or normalized_name = '' then
		raise exception 'Choose an event and enter a Minecraft username.' using errcode = '22023';
	end if;

	select capacity, participant_count, registration_open
	into event_capacity, event_participant_count, event_registration_open
	from public.community_events
	where id = p_event_id
	for update;
	if not found then
		raise exception 'The selected event does not exist.' using errcode = 'P0002';
	end if;
	if not event_registration_open then
		raise exception 'Staff registration is closed for this event.' using errcode = '23514';
	end if;
	if event_capacity is not null and event_participant_count >= event_capacity then
		raise exception 'This event has reached capacity.' using errcode = '23514';
	end if;
	if exists (
		select 1
		from public.community_event_participants
		where event_id = p_event_id and pg_catalog.lower(minecraft_name) = pg_catalog.lower(normalized_name)
	) then
		raise exception 'That player is already listed for this event.' using errcode = '23505';
	end if;

	insert into public.community_event_participants (event_id, minecraft_name, added_by)
	values (p_event_id, normalized_name, auth.uid());
end;
$$;

revoke all on function public.assign_staff_role(uuid, text) from public;
revoke all on function public.revoke_staff_role(uuid, text) from public;
revoke all on function public.change_staff_role(uuid, text, text) from public;
revoke all on function public.add_community_event_participant(uuid, text) from public;
grant execute on function public.assign_staff_role(uuid, text) to authenticated;
grant execute on function public.revoke_staff_role(uuid, text) to authenticated;
grant execute on function public.change_staff_role(uuid, text, text) to authenticated;
grant execute on function public.add_community_event_participant(uuid, text) to authenticated;

create or replace function public.write_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	old_row jsonb;
	new_row jsonb;
	row_key text;
begin
	if tg_op in ('UPDATE', 'DELETE') then
		old_row := pg_catalog.to_jsonb(old);
	end if;
	if tg_op in ('INSERT', 'UPDATE') then
		new_row := pg_catalog.to_jsonb(new);
	end if;

	row_key := coalesce(
		new_row ->> 'id', old_row ->> 'id',
		new_row ->> 'user_id', old_row ->> 'user_id',
		new_row ->> 'player_id', old_row ->> 'player_id'
	);

	insert into public.admin_audit_logs (actor_id, table_name, operation, record_key, old_data, new_data)
	values (auth.uid(), tg_table_name, tg_op, row_key, old_row, new_row);

	if tg_op = 'DELETE' then
		return old;
	end if;
	return new;
end;
$$;

revoke all on function public.write_admin_audit_log() from public, anon, authenticated;

do $$
declare
	table_name text;
begin
	foreach table_name in array array[
		'staff_roles', 'community_players', 'moderation_cases',
		'community_announcements', 'community_events', 'community_event_participants', 'community_polls',
		'community_poll_options', 'community_profiles'
	]
	loop
		execute pg_catalog.format('drop trigger if exists audit_admin_changes on public.%I', table_name);
		execute pg_catalog.format(
			'create trigger audit_admin_changes after insert or update or delete on public.%I for each row execute function public.write_admin_audit_log()',
			table_name
		);
	end loop;
end;
$$;

create or replace function public.get_community_polls()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(
		pg_catalog.jsonb_agg(
			pg_catalog.jsonb_build_object(
				'id', poll.id,
				'title', poll.title,
				'description', poll.description,
				'options', (
					select coalesce(
						pg_catalog.jsonb_agg(
							pg_catalog.jsonb_build_object(
								'id', poll_option.id,
								'label', poll_option.label,
								'votes', (
									select pg_catalog.count(*)
									from public.community_poll_votes poll_vote
									where poll_vote.poll_id = poll.id and poll_vote.option_id = poll_option.id
								)
							) order by poll_option.sort_order
						),
						'[]'::jsonb
					)
					from public.community_poll_options poll_option
					where poll_option.poll_id = poll.id
				)
			) order by poll.created_at desc
		),
		'[]'::jsonb
	)
	from public.community_polls poll
	where poll.is_open;
$$;

create or replace function public.cast_community_poll_vote(p_poll_id uuid, p_voter_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_poll_id is null or p_voter_id is null or p_option_id is null then
		raise exception 'A poll, voter, and option are required.' using errcode = '22023';
	end if;

	if not exists (
		select 1
		from public.community_polls poll
		join public.community_poll_options poll_option on poll_option.poll_id = poll.id
		where poll.id = p_poll_id and poll.is_open and poll_option.id = p_option_id
	) then
		raise exception 'This poll is closed or the option is invalid.' using errcode = '22023';
	end if;

	insert into public.community_poll_votes (poll_id, voter_id, option_id)
	values (p_poll_id, p_voter_id, p_option_id)
	on conflict (poll_id, voter_id) do update
	set option_id = excluded.option_id,
		created_at = pg_catalog.now();

	return public.get_community_polls();
end;
$$;

revoke all on function public.get_community_polls() from public;
revoke all on function public.cast_community_poll_vote(uuid, uuid, uuid) from public;
grant execute on function public.get_community_polls() to anon, authenticated;
grant execute on function public.cast_community_poll_vote(uuid, uuid, uuid) to anon, authenticated;
