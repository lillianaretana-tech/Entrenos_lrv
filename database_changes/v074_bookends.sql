-- Additive change; event media (memory_id IS NULL) retain existing behavior.
begin;
alter table public.media add column if not exists is_closing boolean not null default false;
create unique index if not exists media_one_memory_cover on public.media(space_id) where is_cover and memory_id is not null;
create unique index if not exists media_one_memory_closing on public.media(space_id) where is_closing and memory_id is not null;
alter table public.media add constraint media_memory_bookend_check check (not is_closing or (memory_id is not null and kind='photo' and not coalesce(is_cover,false)));

create or replace function public.set_memory_bookend(p_media_id uuid,p_role text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_space uuid; v_row public.media;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'not allowed'; end if;
 if p_role is null or p_role not in ('cover','closing','normal') then raise exception 'invalid role'; end if;
 select space_id into v_space from public.media where id=p_media_id and memory_id is not null and kind='photo';
 if v_space is null or not public.can_access_space(v_space,true) then raise exception 'not allowed'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_space::text,740));
 -- Clear and replace in the same transaction, under the same per-space lock.
 if p_role='cover' then update public.media set is_cover=false where space_id=v_space and memory_id is not null and is_cover;
 elsif p_role='closing' then update public.media set is_closing=false where space_id=v_space and memory_id is not null and is_closing;
 end if;
 update public.media set is_cover=(p_role='cover'),is_closing=(p_role='closing') where id=p_media_id and space_id=v_space and memory_id is not null and kind='photo' returning * into v_row;
 if v_row.id is null then raise exception 'not found'; end if;
 return jsonb_build_object('id',v_row.id,'is_cover',v_row.is_cover,'is_closing',v_row.is_closing);
end $$;
revoke all on function public.set_memory_bookend(uuid,text) from public,anon;
grant execute on function public.set_memory_bookend(uuid,text) to authenticated;

create or replace function public.set_memory_media_position(p_media_id uuid,p_position integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_space uuid; v_old integer; v_new integer; v_count integer; v_offset integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'not allowed'; end if;
 select space_id into v_space from public.media where id=p_media_id and memory_id is not null;
 if v_space is null or not public.can_access_space(v_space,true) then raise exception 'not allowed'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_space::text,740));
 if exists(select 1 from public.media where id=p_media_id and (is_cover or is_closing)) then raise exception 'fixed page'; end if;
 select count(*) filter(where not coalesce(is_cover,false) and not is_closing),count(*) filter(where is_cover) into v_count,v_offset from public.media where space_id=v_space and memory_id is not null;
 v_new:=greatest(1,least(v_count,p_position-v_offset));
 with ranked as (select id,row_number() over(order by sort_order,created_at desc,id)::integer rn from public.media where space_id=v_space and memory_id is not null and not coalesce(is_cover,false) and not is_closing)
 select rn into v_old from ranked where id=p_media_id;
 if v_old is null then raise exception 'not found'; end if;
 with ranked as (select id,row_number() over(order by sort_order,created_at desc,id)::integer rn from public.media where space_id=v_space and memory_id is not null and not coalesce(is_cover,false) and not is_closing)
 update public.media m set sort_order=case when m.id=p_media_id then v_new when v_new<v_old and r.rn>=v_new and r.rn<v_old then r.rn+1 when v_new>v_old and r.rn>v_old and r.rn<=v_new then r.rn-1 else r.rn end from ranked r where m.id=r.id;
 return v_new+v_offset;
end $$;
revoke all on function public.set_memory_media_position(uuid,integer) from public,anon;
grant execute on function public.set_memory_media_position(uuid,integer) to authenticated;
commit;
