-- ===================================================
-- NOVA AI — Esquema de base de datos
-- Pegar en Supabase SQL Editor y correr
-- ===================================================

-- Tabla de perfiles de usuario (extiende auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
  plan text default 'free' check (plan in ('free', 'pro', 'ultra')),
  messages_today integer default 0,
  images_today integer default 0,
  last_reset date default current_date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla de sesiones de chat
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'Nuevo chat',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla de mensajes
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  image_url text,
  created_at timestamp with time zone default now()
);

-- Índices para performance
create index if not exists idx_messages_session on public.messages(session_id, created_at);
create index if not exists idx_sessions_user on public.chat_sessions(user_id, updated_at desc);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.messages enable row level security;

-- Políticas: cada user solo ve sus propios datos
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "sessions_all_own" on public.chat_sessions;
create policy "sessions_all_own" on public.chat_sessions
  for all using (auth.uid() = user_id);

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

-- Trigger: crear profile automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Función: reset de contadores diarios
create or replace function public.reset_daily_counters()
returns void as $$
begin
  update public.profiles
  set messages_today = 0,
      images_today = 0,
      last_reset = current_date
  where last_reset < current_date;
end;
$$ language plpgsql security definer;
