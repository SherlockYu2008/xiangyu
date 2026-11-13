-- =============================================================================
-- 橡遇 XIANGYU · Supabase 数据库初始化脚本
-- 适用：Supabase 托管的 PostgreSQL / PostgREST
--
-- 使用方式：打开 Supabase Dashboard -> SQL Editor -> New query，粘贴本文件全部内容
-- 后执行。整个脚本位于一个事务中，中途报错会整体回滚，不会留下“做了一半”的表。
--
-- 重要说明（请先读）：
-- 1. 这份脚本尚未在真实的 Supabase 项目上执行过，也没有连接过真实数据库做联调。
--    首次执行请留意 SQL Editor 的报错信息；如果报错，整个事务会回滚，修好后可以重跑。
-- 2. 脚本里的 security definer 函数依赖“脚本执行者拥有表、且能绕过 RLS”。
--    Supabase SQL Editor 默认以 postgres 身份执行，满足这个前提。
--    不要把这些函数改成以普通 authenticated 用户身份创建，否则可能出现 RLS 循环。
-- 3. 建表使用 if not exists，策略使用 drop policy if exists 后重建，种子数据使用
--    on conflict do nothing。因此“空库重复执行”基本安全；但如果表已经存在而结构不同，
--    本脚本不会自动迁移旧表，请另写迁移或先在测试项目验证后重建。
-- 4. 学号只以“规范化后的 SHA-256 十六进制摘要 + 后四位”保存在 profile_private，
--    不进入 profiles，也不会被任何常用 SELECT 返回。由于搜索需要精确等值匹配，
--    这里只能使用无盐 SHA-256（不能像密码一样加随机盐），数据库泄露时学号空间有限，
--    存在被离线枚举的风险；不要把学号当作高安全级别秘密。若未来需要更强保护，
--    应改为服务端加密 + 独立检索方案。
-- 5. AI 功能默认关闭（system_settings.ai_enabled = false），部署后需要手动打开。
--    这是成本与安全上的主动取舍：即使误把 anon key 暴露在前端，也不会产生 AI 账单。
-- =============================================================================

begin;

-- pgcrypto 提供 digest()。Supabase 通常已经预装；若已装在 extensions schema，
-- 这句不会重复安装。find_user_by_student_no 的 search_path 会同时包含 extensions。
create extension if not exists pgcrypto;

-- 本事务内使用常见 schema 顺序；所有对象仍然显式写成 public.*。
set local search_path = public, extensions;

-- =============================================================================
-- 一、表结构
-- 约定：
--   * 主键统一 uuid primary key default gen_random_uuid()
--   * 时间统一 timestamptz；审计时间默认 now()
--   * 枚举统一 text + check，方便以后扩展
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles：公开资料。学号绝对不能放这张表。
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid()
    references auth.users (id) on delete cascade,
  nickname text not null
    check (char_length(nickname) between 1 and 20),
  grade text,
  major text,
  campus text
    check (campus in ('崂山校区', '四方校区', '高密校区')),
  bio text
    check (char_length(bio) <= 300),
  avatar_seed text,
  searchable boolean not null default true,
  topics text[] not null default '{}',
  chat_style text,
  depth_pref smallint
    check (depth_pref between 1 and 5),
  looking_for text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  '公开资料。所有人可读；学号永远不放在这里，只放 profile_private。';

-- ---------------------------------------------------------------------------
-- 2. profile_private：学号摘要。只有本人可读写。
--    student_no_hash = lower(sha256(btrim(student_no))) 的 64 位十六进制字符串。
--    frontend 若自行写入，也必须使用同样的规范化方式；搜索 RPC 会再次计算摘要。
-- ---------------------------------------------------------------------------
create table if not exists public.profile_private (
  user_id uuid primary key
    references public.profiles (id) on delete cascade,
  student_no_hash text not null unique
    check (student_no_hash ~ '^[0-9a-f]{64}$'),
  student_no_last4 text not null
    check (student_no_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

comment on table public.profile_private is
  '学号摘要与后四位。只有本人可 SELECT/INSERT/UPDATE/DELETE；RPC find_user_by_student_no 通过 security definer 精确匹配，且永不回传摘要。';

-- ---------------------------------------------------------------------------
-- 3. interests / user_interests：兴趣标签
-- ---------------------------------------------------------------------------
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  interest_id uuid not null
    references public.interests (id) on delete cascade,
  weight smallint not null default 1
    check (weight between 1 and 5),
  primary key (user_id, interest_id)
);

create index if not exists user_interests_interest_id_idx
  on public.user_interests (interest_id);

-- ---------------------------------------------------------------------------
-- 4. friend_requests / friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null
    references public.profiles (id) on delete cascade,
  to_id uuid not null
    references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  message text
    check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self check (from_id <> to_id),
  constraint friend_requests_pair_unique unique (from_id, to_id)
);

create index if not exists friend_requests_to_id_idx
  on public.friend_requests (to_id, status);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null
    references public.profiles (id) on delete cascade,
  user_b uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_sorted_pair check (user_a < user_b),
  constraint friendships_pair_unique unique (user_a, user_b)
);

create index if not exists friendships_user_b_idx
  on public.friendships (user_b);

-- ---------------------------------------------------------------------------
-- 5. blocks / reports
--    说明：block 只对“拉黑发起者”可见；被拉黑者不会看到这条记录（避免打草惊蛇）。
--    report 只对举报者可见，被举报者看不到；管理员通过 service_role 处理。
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null
    references public.profiles (id) on delete cascade,
  blocked_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_no_self check (blocker_id <> blocked_id),
  constraint blocks_pair_unique unique (blocker_id, blocked_id)
);

create index if not exists blocks_blocked_id_idx
  on public.blocks (blocked_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null
    references public.profiles (id) on delete cascade,
  target_type text not null
    check (target_type in ('user', 'message', 'post')),
  target_id uuid not null,
  reason text,
  detail text
    check (char_length(detail) <= 500),
  status text not null default 'open'
    check (status in ('open', 'handled', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_reporter_id_idx
  on public.reports (reporter_id, created_at desc);
create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. 兴趣圈：circles / circle_members / circle_posts / circle_post_members
-- ---------------------------------------------------------------------------
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text,
  category text,
  description text,
  rules text,
  campus text,
  member_count integer not null default 0
    check (member_count >= 0),
  created_by uuid
    references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null
    references public.circles (id) on delete cascade,
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  role text not null default 'member'
    check (role in ('member', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index if not exists circle_members_user_id_idx
  on public.circle_members (user_id);

create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null
    references public.circles (id) on delete cascade,
  author_id uuid not null
    references public.profiles (id) on delete cascade,
  kind text not null default 'buddy'
    check (kind in ('buddy', 'talk', 'recruit')),
  title text not null
    check (char_length(title) between 1 and 60),
  body text
    check (char_length(body) <= 1000),
  meet_time text,
  place text,
  capacity smallint not null default 4
    check (capacity between 2 and 50),
  tags text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'full', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists circle_posts_circle_created_idx
  on public.circle_posts (circle_id, created_at desc);
create index if not exists circle_posts_author_id_idx
  on public.circle_posts (author_id);

create table if not exists public.circle_post_members (
  post_id uuid not null
    references public.circle_posts (id) on delete cascade,
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists circle_post_members_user_id_idx
  on public.circle_post_members (user_id);

-- ---------------------------------------------------------------------------
-- 7. 会话与消息
--    注意：会话的 RLS 引导逻辑会在后面“策略”部分详细说明。
--    客户端如果不使用 .select() 取回新建会话，建议在插入时自己生成 UUID。
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('direct', 'circle')),
  circle_id uuid
    references public.circles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_kind_circle_match check (
    (kind = 'direct' and circle_id is null)
    or (kind = 'circle' and circle_id is not null)
  )
);

create index if not exists conversations_circle_id_idx
  on public.conversations (circle_id);

create table if not exists public.conversation_members (
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  sender_id uuid not null
    references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- 8. 匹配偏好与会话记录
-- ---------------------------------------------------------------------------
create table if not exists public.match_preferences (
  user_id uuid primary key
    references public.profiles (id) on delete cascade,
  tags text[] not null default '{}',
  topics text[] not null default '{}',
  chat_style text,
  depth smallint
    check (depth between 1 and 5),
  looking_for text,
  weights jsonb not null default
    '{"tag": 0.5, "topic": 0.2, "style": 0.15, "depth": 0.15}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null
    references public.profiles (id) on delete cascade,
  user_b uuid not null
    references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('interest', 'random', 'deep')),
  score numeric(5, 2),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint match_sessions_no_self check (user_a <> user_b)
);

create index if not exists match_sessions_user_a_idx
  on public.match_sessions (user_a, created_at desc);
create index if not exists match_sessions_user_b_idx
  on public.match_sessions (user_b, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. AI 计量、缓存与全站设置
--    ai_usage 由 Edge Function 用 service_role 写入；浏览器端只能读自己的记录。
--    ai_cache / system_settings 完全不对 authenticated 开放。
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  feature text not null
    check (feature in ('icebreaker', 'explain', 'summary', 'topic_suggest')),
  tokens_in integer not null default 0
    check (tokens_in >= 0),
  tokens_out integer not null default 0
    check (tokens_out >= 0),
  cost numeric(10, 6) not null default 0
    check (cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at);

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  feature text,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_cache_expires_at_idx
  on public.ai_cache (expires_at);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. student_lookup_attempts：学号搜索限流日志（防枚举）
--     只能由 security definer RPC 写入；客户端不可读写。
-- ---------------------------------------------------------------------------
create table if not exists public.student_lookup_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists student_lookup_attempts_user_time_idx
  on public.student_lookup_attempts (user_id, attempted_at desc);

-- =============================================================================
-- 二、RLS 辅助函数
-- 这些函数统一 security definer + set search_path = public，目的是绕过被查询表自身
-- 的 RLS，避免“策略里再查同一张表 -> 无限递归”的经典问题。
-- 函数内部只按 auth.uid() 或显式参数判断，不接收外部拼接 SQL。
-- =============================================================================

-- 当前登录用户是否在某个会话中。
create or replace function public.is_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conv
      and cm.user_id = (select auth.uid())
  );
$function$;

-- 两个人任意方向是否存在拉黑。
create or replace function public.is_blocked_pair(
  p_user_a uuid,
  p_user_b uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$function$;

-- 会话成员数。用于限制 direct 会话最多两人，以及空会话的引导加入。
create or replace function public.conversation_member_count(conv uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select count(*)::integer
  from public.conversation_members cm
  where cm.conversation_id = conv;
$function$;

-- 是否是“还没有任何成员的 direct 会话”。RLS 下非成员看不到成员表，
-- 因此必须 security definer 才能正确判断。
create or replace function public.is_empty_direct_conversation(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv
      and c.kind = 'direct'
      and not exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = c.id
      )
  );
$function$;

-- 用户是否属于某个“兴趣圈会话”对应的兴趣圈。
-- 参数显式传入 user_id，方便策略中传 auth.uid()；不直接依赖当前 JWT。
create or replace function public.is_circle_member_of_conversation(
  conv uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.conversations c
    join public.circle_members cm
      on cm.circle_id = c.circle_id
    where c.id = conv
      and c.kind = 'circle'
      and cm.user_id = p_user_id
  );
$function$;

-- 收回默认 PUBLIC 执行权限，只给登录用户和 service_role。
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_blocked_pair(uuid, uuid) from public, anon;
revoke all on function public.conversation_member_count(uuid) from public, anon;
revoke all on function public.is_empty_direct_conversation(uuid) from public, anon;
revoke all on function public.is_circle_member_of_conversation(uuid, uuid)
  from public, anon;

grant execute on function public.is_member(uuid) to authenticated, service_role;
grant execute on function public.is_blocked_pair(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.conversation_member_count(uuid)
  to authenticated, service_role;
grant execute on function public.is_empty_direct_conversation(uuid)
  to authenticated, service_role;
grant execute on function public.is_circle_member_of_conversation(uuid, uuid)
  to authenticated, service_role;

-- =============================================================================
-- 三、RLS 开关与策略
-- 所有表都 enable row level security。
-- 每张表都先 drop policy if exists，再 create policy，便于重复执行。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 不开放 DELETE：删号应走 auth.users 删除，profiles 会级联删除。

-- ---------------------------------------------------------------------------
-- profile_private：只有本人
-- ---------------------------------------------------------------------------
alter table public.profile_private enable row level security;

drop policy if exists profile_private_select_self on public.profile_private;
create policy profile_private_select_self
  on public.profile_private
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists profile_private_insert_self on public.profile_private;
create policy profile_private_insert_self
  on public.profile_private
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists profile_private_update_self on public.profile_private;
create policy profile_private_update_self
  on public.profile_private
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists profile_private_delete_self on public.profile_private;
create policy profile_private_delete_self
  on public.profile_private
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- interests：所有人读；写只留给 service_role（种子/运营配置）
-- ---------------------------------------------------------------------------
alter table public.interests enable row level security;

drop policy if exists interests_select_all on public.interests;
create policy interests_select_all
  on public.interests
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- user_interests：登录用户可读（用于展示兴趣标签），本人可写自己的。
-- 这里只开放 SELECT，不公开带权重的写入口。
-- ---------------------------------------------------------------------------
alter table public.user_interests enable row level security;

drop policy if exists user_interests_select_authenticated on public.user_interests;
create policy user_interests_select_authenticated
  on public.user_interests
  for select
  to authenticated
  using (true);

drop policy if exists user_interests_insert_self on public.user_interests;
create policy user_interests_insert_self
  on public.user_interests
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_interests_update_self on public.user_interests;
create policy user_interests_update_self
  on public.user_interests
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_interests_delete_self on public.user_interests;
create policy user_interests_delete_self
  on public.user_interests
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- friend_requests：仅收发双方可见
-- ---------------------------------------------------------------------------
alter table public.friend_requests enable row level security;

drop policy if exists friend_requests_select_participants
  on public.friend_requests;
create policy friend_requests_select_participants
  on public.friend_requests
  for select
  to authenticated
  using (
    from_id = (select auth.uid())
    or to_id = (select auth.uid())
  );

drop policy if exists friend_requests_insert_sender
  on public.friend_requests;
create policy friend_requests_insert_sender
  on public.friend_requests
  for insert
  to authenticated
  with check (
    from_id = (select auth.uid())
    and not public.is_blocked_pair((select auth.uid()), to_id)
  );

-- 只有收件人可以改状态（接受/拒绝）。RLS 无法限制具体列，
-- 所以前端应当只更新 status；不要修改 from_id / to_id。
drop policy if exists friend_requests_update_recipient
  on public.friend_requests;
create policy friend_requests_update_recipient
  on public.friend_requests
  for update
  to authenticated
  using (to_id = (select auth.uid()))
  with check (to_id = (select auth.uid()));

drop policy if exists friend_requests_delete_participants
  on public.friend_requests;
create policy friend_requests_delete_participants
  on public.friend_requests
  for delete
  to authenticated
  using (
    from_id = (select auth.uid())
    or to_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- friendships：双方可见；只有已存在的 accepted 申请才能落成好友关系
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;

drop policy if exists friendships_select_participants on public.friendships;
create policy friendships_select_participants
  on public.friendships
  for select
  to authenticated
  using (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  );

drop policy if exists friendships_insert_from_accepted_request
  on public.friendships;
create policy friendships_insert_from_accepted_request
  on public.friendships
  for insert
  to authenticated
  with check (
    (
      user_a = (select auth.uid())
      or user_b = (select auth.uid())
    )
    and exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.from_id = user_a and fr.to_id = user_b)
          or (fr.from_id = user_b and fr.to_id = user_a)
        )
    )
  );

drop policy if exists friendships_delete_participants on public.friendships;
create policy friendships_delete_participants
  on public.friendships
  for delete
  to authenticated
  using (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- blocks：只对拉黑发起者可见、可增删；被拉黑者不可见
-- ---------------------------------------------------------------------------
alter table public.blocks enable row level security;

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own
  on public.blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reports：举报者可见；被举报者不可见；客户端只读自己的举报、只可新建
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own
  on public.reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

-- 状态变更仅由 service_role / 管理员处理，浏览器端不能改。

-- ---------------------------------------------------------------------------
-- circles：所有人可读；登录用户可创建，created_by 必须是本人
-- ---------------------------------------------------------------------------
alter table public.circles enable row level security;

drop policy if exists circles_select_all on public.circles;
create policy circles_select_all
  on public.circles
  for select
  to anon, authenticated
  using (true);

drop policy if exists circles_insert_authenticated on public.circles;
create policy circles_insert_authenticated
  on public.circles
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and member_count = 0
  );

-- 圈子资料的修改/删除没有开放给普通客户端，避免多人运营误改。
-- 如要开放，请另加“created_by = auth.uid()”的 UPDATE/DELETE 策略。

-- ---------------------------------------------------------------------------
-- circle_members：所有人可读；本人可加入/退出
-- ---------------------------------------------------------------------------
alter table public.circle_members enable row level security;

drop policy if exists circle_members_select_all on public.circle_members;
create policy circle_members_select_all
  on public.circle_members
  for select
  to anon, authenticated
  using (true);

drop policy if exists circle_members_insert_self on public.circle_members;
create policy circle_members_insert_self
  on public.circle_members
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      role = 'member'
      or (
        role = 'owner'
        and exists (
          select 1
          from public.circles c
          where c.id = circle_members.circle_id
            and c.created_by = (select auth.uid())
        )
      )
    )
  );

drop policy if exists circle_members_delete_self on public.circle_members;
create policy circle_members_delete_self
  on public.circle_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- circle_posts：所有人可读；登录用户可发帖；只有作者可改删
-- ---------------------------------------------------------------------------
alter table public.circle_posts enable row level security;

drop policy if exists circle_posts_select_all on public.circle_posts;
create policy circle_posts_select_all
  on public.circle_posts
  for select
  to anon, authenticated
  using (true);

drop policy if exists circle_posts_insert_author on public.circle_posts;
create policy circle_posts_insert_author
  on public.circle_posts
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists circle_posts_update_author on public.circle_posts;
create policy circle_posts_update_author
  on public.circle_posts
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists circle_posts_delete_author on public.circle_posts;
create policy circle_posts_delete_author
  on public.circle_posts
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- circle_post_members：所有人可读；本人加入/退出
-- 人数是否满员由触发器保证，见后文。
-- ---------------------------------------------------------------------------
alter table public.circle_post_members enable row level security;

drop policy if exists circle_post_members_select_all
  on public.circle_post_members;
create policy circle_post_members_select_all
  on public.circle_post_members
  for select
  to anon, authenticated
  using (true);

drop policy if exists circle_post_members_insert_self
  on public.circle_post_members;
create policy circle_post_members_insert_self
  on public.circle_post_members
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists circle_post_members_delete_self
  on public.circle_post_members;
create policy circle_post_members_delete_self
  on public.circle_post_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- conversations：只有成员可见。
-- 新建 direct 会话的“引导流程”：
--   1) 任意登录用户插入一条 direct 会话（建议客户端自己生成 id）；
--   2) 插入自己的 conversation_members 行；
--   3) 由自己把另一位用户加入（仅允许 direct、且总人数 < 2）。
-- 兴趣圈会话只能由该圈成员创建，圈成员可各自加入该会话。
-- 这不是“服务端事务”，前端需要按顺序调用；任何一步失败都要清理已插入的行。
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists conversations_select_members on public.conversations;
create policy conversations_select_members
  on public.conversations
  for select
  to authenticated
  using (public.is_member(id));

drop policy if exists conversations_insert_authenticated on public.conversations;
create policy conversations_insert_authenticated
  on public.conversations
  for insert
  to authenticated
  with check (
    kind = 'direct'
    or (
      kind = 'circle'
      and exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = conversations.circle_id
          and cm.user_id = (select auth.uid())
      )
    )
  );

-- 会话没有开放 UPDATE/DELETE；需要清理时用 service_role。

-- ---------------------------------------------------------------------------
-- conversation_members：成员可见；本人可加入（受控引导/圈会话）；可更新已读；可退出
-- 为支持“把好友拉进 direct 会话”，仅允许已有一个成员时再加入第二人，且不能是
-- 拉黑关系。加入后 direct 最多两人，符合直接会话语义。
-- ---------------------------------------------------------------------------
alter table public.conversation_members enable row level security;

drop policy if exists conversation_members_select_members
  on public.conversation_members;
create policy conversation_members_select_members
  on public.conversation_members
  for select
  to authenticated
  using (public.is_member(conversation_id));

drop policy if exists conversation_members_insert_controlled
  on public.conversation_members;
create policy conversation_members_insert_controlled
  on public.conversation_members
  for insert
  to authenticated
  with check (
    (
      -- 自己加入：空 direct 会话的第一个成员；或圈会话对应的圈子成员；
      -- 或本来就是成员（重复插入会被主键拦截，实际无害）。
      user_id = (select auth.uid())
      and (
        public.is_member(conversation_id)
        or public.is_empty_direct_conversation(conversation_id)
        or public.is_circle_member_of_conversation(
          conversation_id,
          (select auth.uid())
        )
      )
    )
    or (
      -- 已入会的成员把第二个人拉进 direct 会话。
      public.is_member(conversation_id)
      and public.conversation_member_count(conversation_id) = 1
      and not public.is_blocked_pair((select auth.uid()), user_id)
      and exists (
        select 1
        from public.conversations c
        where c.id = conversation_members.conversation_id
          and c.kind = 'direct'
      )
    )
  );

drop policy if exists conversation_members_update_last_read_self
  on public.conversation_members;
create policy conversation_members_update_last_read_self
  on public.conversation_members
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists conversation_members_delete_self
  on public.conversation_members;
create policy conversation_members_delete_self
  on public.conversation_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- messages：成员可读；发送者必须是本人；已发消息不可改删
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members
  on public.messages
  for select
  to authenticated
  using (public.is_member(conversation_id));

drop policy if exists messages_insert_member_self on public.messages;
create policy messages_insert_member_self
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_member(conversation_id)
  );

-- 消息不做 UPDATE/DELETE 策略，保持聊天记录不可篡改。

-- ---------------------------------------------------------------------------
-- match_preferences：只有本人可读写
-- ---------------------------------------------------------------------------
alter table public.match_preferences enable row level security;

drop policy if exists match_preferences_select_self
  on public.match_preferences;
create policy match_preferences_select_self
  on public.match_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists match_preferences_insert_self
  on public.match_preferences;
create policy match_preferences_insert_self
  on public.match_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists match_preferences_update_self
  on public.match_preferences;
create policy match_preferences_update_self
  on public.match_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists match_preferences_delete_self
  on public.match_preferences;
create policy match_preferences_delete_self
  on public.match_preferences
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- match_sessions：只有两位当事人可见/可写
-- 具体匹配算法推荐放在 Edge Function / 服务端；这里保留客户端可写入的能力，
-- 但 RLS 不允许无关用户看到或伪造到不相关的人身上。
-- ---------------------------------------------------------------------------
alter table public.match_sessions enable row level security;

drop policy if exists match_sessions_select_participants
  on public.match_sessions;
create policy match_sessions_select_participants
  on public.match_sessions
  for select
  to authenticated
  using (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  );

drop policy if exists match_sessions_insert_participants
  on public.match_sessions;
create policy match_sessions_insert_participants
  on public.match_sessions
  for insert
  to authenticated
  with check (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  );

drop policy if exists match_sessions_update_participants
  on public.match_sessions;
create policy match_sessions_update_participants
  on public.match_sessions
  for update
  to authenticated
  using (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  )
  with check (
    user_a = (select auth.uid())
    or user_b = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- ai_usage：仅本人可读；写权限只给 service_role（Edge Function 使用）
-- ---------------------------------------------------------------------------
alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select_self on public.ai_usage;
create policy ai_usage_select_self
  on public.ai_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 浏览器端没有 INSERT/UPDATE/DELETE 策略；同时在文件末尾 revoke 表权限，双保险。

-- ---------------------------------------------------------------------------
-- ai_cache / system_settings：不对 anon / authenticated 开放
-- 只保留 service_role（绕过 RLS）读写。注意：无策略 = 默认拒绝。
-- ---------------------------------------------------------------------------
alter table public.ai_cache enable row level security;
alter table public.system_settings enable row level security;

-- 不需要为这两张表创建任何 authenticated 策略。

-- ---------------------------------------------------------------------------
-- student_lookup_attempts：不对客户端开放，只能由 RPC 写入
-- ---------------------------------------------------------------------------
alter table public.student_lookup_attempts enable row level security;

-- =============================================================================
-- 四、触发器
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 新用户自动建 profiles
-- raw_user_meta_data 中可带 nickname / grade / major / campus。
-- 直接改 auth.users 表和这里的触发函数属于 Supabase 支持的常见用法。
-- 注意：nickname 超长会被截断到 20 字符；campus 非法值会被置空，避免注册失败。
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_nickname text;
  v_campus text;
begin
  v_nickname := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 20), '');

  if v_nickname is null then
    -- 没填昵称时退化为邮箱前缀；再不行用“新同学”。
    v_nickname := nullif(
      left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 20),
      ''
    );
  end if;

  if v_nickname is null then
    v_nickname := '新同学';
  end if;

  v_campus := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'campus', '')), '');

  if v_campus is not null
     and v_campus not in ('崂山校区', '四方校区', '高密校区') then
    v_campus := null;
  end if;

  insert into public.profiles (
    id,
    nickname,
    grade,
    major,
    campus
  )
  values (
    new.id,
    v_nickname,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'grade', '')), 50), ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'major', '')), 50), ''),
    v_campus
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4.2 兴趣圈成员数维护
-- ---------------------------------------------------------------------------
create or replace function public.sync_circle_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    update public.circles
    set member_count = member_count + 1
    where id = new.circle_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.circles
    set member_count = greatest(member_count - 1, 0)
    where id = old.circle_id;
    return old;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_circle_members_count_ins on public.circle_members;
create trigger trg_circle_members_count_ins
  after insert on public.circle_members
  for each row
  execute function public.sync_circle_member_count();

drop trigger if exists trg_circle_members_count_del on public.circle_members;
create trigger trg_circle_members_count_del
  after delete on public.circle_members
  for each row
  execute function public.sync_circle_member_count();

-- ---------------------------------------------------------------------------
-- 4.3 搭子帖满员状态维护
-- guard：加入前锁住帖子行，防止并发超额；full/closed 直接拒绝。
-- sync：加入达到 capacity 置 full；有人退出且未满时把 full 恢复为 open。
-- 如作者主动改为 closed，不会因为有人退出而被自动打开。
-- ---------------------------------------------------------------------------
create or replace function public.guard_circle_post_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_capacity smallint;
  v_status text;
  v_joined integer;
begin
  select cp.capacity, cp.status
    into v_capacity, v_status
  from public.circle_posts cp
  where cp.id = new.post_id
  for update;

  if not found then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'open' then
    raise exception 'POST_NOT_OPEN' using errcode = 'P0001';
  end if;

  select count(*)::integer
    into v_joined
  from public.circle_post_members cpm
  where cpm.post_id = new.post_id;

  if v_joined >= v_capacity then
    raise exception 'POST_FULL' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create or replace function public.sync_circle_post_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_capacity smallint;
  v_joined integer;
begin
  if tg_op = 'INSERT' then
    select cp.capacity
      into v_capacity
    from public.circle_posts cp
    where cp.id = new.post_id;

    if v_capacity is null then
      return new;
    end if;

    select count(*)::integer
      into v_joined
    from public.circle_post_members cpm
    where cpm.post_id = new.post_id;

    if v_joined >= v_capacity then
      update public.circle_posts
      set status = 'full'
      where id = new.post_id
        and status = 'open';
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    select cp.capacity
      into v_capacity
    from public.circle_posts cp
    where cp.id = old.post_id;

    if v_capacity is null then
      return old;
    end if;

    select count(*)::integer
      into v_joined
    from public.circle_post_members cpm
    where cpm.post_id = old.post_id;

    if v_joined < v_capacity then
      update public.circle_posts
      set status = 'open'
      where id = old.post_id
        and status = 'full';
    end if;

    return old;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_circle_post_join_guard on public.circle_post_members;
create trigger trg_circle_post_join_guard
  before insert on public.circle_post_members
  for each row
  execute function public.guard_circle_post_join();

drop trigger if exists trg_circle_post_status_ins on public.circle_post_members;
create trigger trg_circle_post_status_ins
  after insert on public.circle_post_members
  for each row
  execute function public.sync_circle_post_status();

drop trigger if exists trg_circle_post_status_del on public.circle_post_members;
create trigger trg_circle_post_status_del
  after delete on public.circle_post_members
  for each row
  execute function public.sync_circle_post_status();

-- =============================================================================
-- 五、RPC
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 学号精确搜索（防枚举）
-- 规则：
--   * 只接受 4~32 位数字，先 trim
--   * 同一登录用户每小时最多 30 次；用事务级 advisory lock 串行化同一用户的并发请求
--   * 每次有效尝试都写 student_lookup_attempts（包括“查无此人”）
--   * 只匹配 searchable = true、非本人、双方没有拉黑关系的资料
--   * 返回字段绝不包含学号摘要或后四位
--   * 查无结果返回 0 行，不抛“用户不存在”，降低枚举时可利用的差异
--
-- pgcrypto 在 Supabase 通常位于 extensions schema，因此这里的 search_path
-- 额外带上 extensions；若你的实例把扩展装在别处，请把对应 schema 加进来。
-- ---------------------------------------------------------------------------
create or replace function public.find_user_by_student_no(p_student_no text)
returns table (
  id uuid,
  nickname text,
  grade text,
  major text,
  campus text,
  bio text,
  avatar_seed text
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_no text := btrim(coalesce(p_student_no, ''));
  v_hash text;
  v_attempts integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_student_no !~ '^[0-9]{4,32}$' then
    raise exception 'INVALID_STUDENT_NO' using errcode = 'P0001';
  end if;

  -- 同一用户串行执行，避免并发请求同时通过次数检查。
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select count(*)::integer
    into v_attempts
  from public.student_lookup_attempts sla
  where sla.user_id = v_uid
    and sla.attempted_at >= now() - interval '1 hour';

  if v_attempts >= 30 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.student_lookup_attempts (user_id)
  values (v_uid);

  v_hash := encode(digest(v_student_no, 'sha256'), 'hex');

  return query
  select
    p.id,
    p.nickname,
    p.grade,
    p.major,
    p.campus,
    p.bio,
    p.avatar_seed
  from public.profile_private pp
  join public.profiles p on p.id = pp.user_id
  where pp.student_no_hash = v_hash
    and p.searchable = true
    and p.id <> v_uid
    and not exists (
      select 1
      from public.blocks b
      where (b.blocker_id = v_uid and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = v_uid)
    )
  limit 1;
end;
$function$;

revoke all on function public.find_user_by_student_no(text) from public, anon;
grant execute on function public.find_user_by_student_no(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5.2 兴趣圈搭子帖聚合
-- 返回帖子字段 + 作者昵称 + 已加入人数，按最新排序。
-- 用 security definer 统一聚合，避免前端为了计数再发多次查询。
-- 帖子和成员本来对所有人可读；函数仍只授权给登录用户，减少匿名爬取。
-- ---------------------------------------------------------------------------
create or replace function public.circle_feed(p_circle_id uuid)
returns table (
  id uuid,
  circle_id uuid,
  author_id uuid,
  kind text,
  title text,
  body text,
  meet_time text,
  place text,
  capacity smallint,
  tags text[],
  status text,
  created_at timestamptz,
  author_nickname text,
  joined_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    cp.id,
    cp.circle_id,
    cp.author_id,
    cp.kind,
    cp.title,
    cp.body,
    cp.meet_time,
    cp.place,
    cp.capacity,
    cp.tags,
    cp.status,
    cp.created_at,
    coalesce(p.nickname, '已注销用户') as author_nickname,
    (
      select count(*)::bigint
      from public.circle_post_members cpm
      where cpm.post_id = cp.id
    ) as joined_count
  from public.circle_posts cp
  left join public.profiles p on p.id = cp.author_id
  where cp.circle_id = p_circle_id
  order by cp.created_at desc;
$function$;

revoke all on function public.circle_feed(uuid) from public, anon;
grant execute on function public.circle_feed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5.3 AI 成本聚合辅助函数（仅供 Edge Function 的 service_role 使用）
-- PostgREST 默认单次最多返回 1000 行，直接 select 全部成本在极端情况下会截断；
-- 这里用数据库 SUM 得到准确的当日已记录成本。
-- ---------------------------------------------------------------------------
create or replace function public.ai_usage_cost_since(p_since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(sum(au.cost), 0)::numeric
  from public.ai_usage au
  where au.created_at >= p_since;
$function$;

revoke all on function public.ai_usage_cost_since(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ai_usage_cost_since(timestamptz)
  to service_role;

-- =============================================================================
-- 六、表级权限加固（RLS 之外的第二道锁）
-- Supabase 默认会把 public 表授权给 anon/authenticated；对敏感表再做显式 revoke。
-- service_role 的 RLS bypass 不等于表权限，所以这里显式授予需要的操作。
-- =============================================================================

revoke all on table public.ai_usage from public, anon, authenticated;
grant select on table public.ai_usage to authenticated;
grant select, insert, update, delete on table public.ai_usage to service_role;

revoke all on table public.ai_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_cache to service_role;

revoke all on table public.system_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.system_settings to service_role;

revoke all on table public.student_lookup_attempts
  from public, anon, authenticated;
grant select, insert, update, delete on table public.student_lookup_attempts
  to service_role;

-- =============================================================================
-- 七、种子数据
-- 全部使用 on conflict do nothing，可重复执行，不会覆盖运营后的数据。
-- =============================================================================

-- 12 个兴趣标签
insert into public.interests (tag, category)
values
  ('羽毛球', '运动'),
  ('摇滚', '音乐'),
  ('文学', '阅读'),
  ('摄影', '影像'),
  ('编程', '技术'),
  ('人工智能', '技术'),
  ('考研', '学习'),
  ('四级', '学习'),
  ('夜跑', '运动'),
  ('咖啡', '生活'),
  ('剧本杀', '娱乐'),
  ('美食', '生活')
on conflict (tag) do nothing;

-- 8 个兴趣圈（slug / 名称 / emoji 为前端约定值，请勿随意修改）
insert into public.circles (
  slug,
  name,
  emoji,
  category,
  description,
  rules,
  campus,
  member_count,
  created_by
)
values
  (
    'study',
    '学习考证',
    '🎓',
    '学习',
    '自习、考研、四六级与竞赛信息互助，一起把 flag 立住。',
    '禁止代考、卖答案和任何学术不端；广告与拼课请先说明。',
    null,
    0,
    null
  ),
  (
    'sport',
    '运动健身',
    '🏸',
    '运动',
    '羽毛球、夜跑、健身、球局约伴，运动搭子在这里集合。',
    '约球请守时；取消提前说；注意运动安全与场地规则。',
    null,
    0,
    null
  ),
  (
    'art',
    '文艺生活',
    '🎸',
    '文艺',
    '摇滚、摄影、电影、文学，交换歌单和看不完的书单。',
    '尊重原创；转载注明出处；友好讨论，不人身攻击。',
    null,
    0,
    null
  ),
  (
    'tech',
    '技术极客',
    '💻',
    '技术',
    '编程、人工智能、开源项目与黑客松，找队友一起折腾。',
    '不发布破解、外挂和侵犯隐私的内容；提问前先搜索。',
    null,
    0,
    null
  ),
  (
    'game',
    '游戏电竞',
    '🎮',
    '游戏',
    '开黑、桌游、主机与电竞赛事，拒绝压力怪和挂机党。',
    '娱乐为主；不组织赌博；不传播外挂与代练交易。',
    null,
    0,
    null
  ),
  (
    'food',
    '吃喝玩乐',
    '🍜',
    '生活',
    '食堂探店、奶茶咖啡、宵夜搭子，青科大的快乐吃法。',
    '真实分享；不发布虚假团购与付费引流；适量点餐。',
    null,
    0,
    null
  ),
  (
    'outdoor',
    '户外旅行',
    '⛰️',
    '户外',
    '爬山、骑行、露营、看海，周末一起出门吹风。',
    '安全第一；购买必要保险；不组织无准备的野线。',
    null,
    0,
    null
  ),
  (
    'volunteer',
    '志愿公益',
    '🌱',
    '公益',
    '校内外志愿活动、公益搭子和经验分享，让善意有回声。',
    '不借公益名义收费或收集隐私；活动信息须可核实。',
    null,
    0,
    null
  )
on conflict (slug) do nothing;

-- AI 运行时设置的初始值（默认关闭，省钱也省心；需要时在 SQL Editor 手动打开）
-- 这些 key 与 supabase/functions/ai-assist/index.ts 中的读取逻辑一一对应。
insert into public.system_settings (key, value)
values
  ('ai_enabled', 'false'::jsonb),
  ('ai_daily_user_limit', '5'::jsonb),
  ('ai_cooldown_seconds', '20'::jsonb),
  ('ai_daily_global_limit', '300'::jsonb),
  ('ai_daily_budget_cny', '1.5'::jsonb)
on conflict (key) do nothing;

-- 提示 PostgREST 重新加载 schema 缓存（某些环境需要这个 NOTIFY 才能立刻看到新表/函数）。
notify pgrst, 'reload schema';

commit;
