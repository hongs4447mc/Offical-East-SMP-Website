create table if not exists public.protagonist_votes (
	voter_id uuid primary key,
	choice text not null check (choice in ('east', 'hongs', 'turtlebee')),
	updated_at timestamptz not null default now()
);

alter table public.protagonist_votes enable row level security;
revoke all on table public.protagonist_votes from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.get_protagonist_vote_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select pg_catalog.jsonb_build_object(
		'east', pg_catalog.count(*) filter (where choice = 'east'),
		'hongs', pg_catalog.count(*) filter (where choice = 'hongs'),
		'turtlebee', pg_catalog.count(*) filter (where choice = 'turtlebee')
	)
	from public.protagonist_votes;
$$;

create or replace function public.cast_protagonist_vote(p_voter_id uuid, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_voter_id is null or p_choice is null or p_choice not in ('east', 'hongs', 'turtlebee') then
		raise exception 'Invalid vote.' using errcode = '22023';
	end if;

	insert into public.protagonist_votes (voter_id, choice, updated_at)
	values (p_voter_id, p_choice, pg_catalog.now())
	on conflict (voter_id) do update
	set choice = excluded.choice,
		updated_at = excluded.updated_at;

	return public.get_protagonist_vote_counts();
end;
$$;

revoke all on function public.get_protagonist_vote_counts() from public;
revoke all on function public.cast_protagonist_vote(uuid, text) from public;
grant execute on function public.get_protagonist_vote_counts() to anon, authenticated;
grant execute on function public.cast_protagonist_vote(uuid, text) to anon, authenticated;
