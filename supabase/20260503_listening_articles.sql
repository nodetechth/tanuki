create table if not exists public.listening_articles (
  id text primary key,
  content_type text not null default 'listening'
    check (content_type in ('shadowing', 'listening')),
  category text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  level_label text not null,
  title text not null,
  description text not null,
  body jsonb not null default '[]'::jsonb,
  key_words jsonb not null default '[]'::jsonb,
  read_time_minutes integer not null default 2,
  word_count integer not null default 0,
  wpm integer not null default 120,
  audio_url text,
  published_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_listening_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null references public.listening_articles(id) on delete cascade,
  is_favorite boolean not null default false,
  completed_at timestamptz,
  read_completed_at timestamptz,
  shadowing_completed_at timestamptz,
  last_shadowing_submission_id uuid references public.submissions(id) on delete set null,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists listening_articles_category_level_idx
  on public.listening_articles(category, level, published_at desc);

create index if not exists listening_articles_content_type_idx
  on public.listening_articles(content_type, category, level, published_at desc);

create index if not exists user_listening_articles_favorite_idx
  on public.user_listening_articles(user_id, is_favorite, updated_at desc);

create index if not exists user_listening_articles_read_completed_idx
  on public.user_listening_articles(user_id, read_completed_at desc)
  where read_completed_at is not null;

create index if not exists user_listening_articles_shadowing_completed_idx
  on public.user_listening_articles(user_id, shadowing_completed_at desc)
  where shadowing_completed_at is not null;

alter table public.listening_articles enable row level security;
alter table public.user_listening_articles enable row level security;

create policy "listening articles are readable"
  on public.listening_articles for select
  using (true);

create policy "users can read own listening state"
  on public.user_listening_articles for select
  using (auth.uid() = user_id);

create policy "users can upsert own listening state"
  on public.user_listening_articles for insert
  with check (auth.uid() = user_id);

create policy "users can update own listening state"
  on public.user_listening_articles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.listening_articles (
  id,
  content_type,
  category,
  level,
  level_label,
  title,
  description,
  body,
  key_words,
  read_time_minutes,
  word_count,
  wpm,
  published_at
)
values
  (
    'morning-routine-reset',
    'shadowing',
    '生活',
    'beginner',
    '初級',
    'A Small Morning Reset',
    '朝の小さな習慣で一日を整える話。',
    $json$[
      {"en":"Many people start the day by checking their phone. They read messages, open social media, and look at the news before they even stand up. This feels normal, but it can make the morning busy before the day has really started.","ja":"多くの人はスマホを見ることから一日を始めます。起き上がる前にメッセージを読み、SNSを開き、ニュースを確認します。普通のことに感じますが、一日が本格的に始まる前から朝を慌ただしくしてしまうことがあります。"},
      {"en":"A small morning reset can help. Before touching your phone, drink water, open a window, and take three slow breaths. Then choose one important task for the day. It does not have to be a big goal. It can be something simple, like sending one email or reviewing one lesson.","ja":"小さな朝のリセットが役立ちます。スマホに触る前に水を飲み、窓を開け、ゆっくり3回呼吸します。それから、その日に大切なタスクを1つ選びます。大きな目標である必要はありません。メールを1通送る、レッスンを1つ復習する、といった簡単なことで十分です。"},
      {"en":"When the first few minutes are calm, the rest of the day often feels clearer. You still have work, messages, and plans, but you begin with a little more control.","ja":"最初の数分が落ち着いていると、その後の一日も少し見通しやすくなります。仕事、メッセージ、予定は変わらずありますが、少し自分でコントロールできている感覚から始められます。"}
    ]$json$::jsonb,
    '["routine","social","goal","control"]'::jsonb,
    1,
    162,
    115,
    '2026-05-03'
  ),
  (
    'meeting-with-clear-purpose',
    'shadowing',
    'ビジネス',
    'intermediate',
    '中級',
    'Meetings Need a Clear Purpose',
    '会議を短く、有意義にするための考え方。',
    $json$[
      {"en":"A meeting is useful when everyone understands why they are there. However, many meetings begin with a vague topic and no clear decision to make. People talk for a long time, but no one knows what should happen next.","ja":"会議は、参加者全員が目的を理解しているときに役立ちます。しかし多くの会議は、曖昧なテーマだけで始まり、何を決めるのかがはっきりしていません。長く話しても、次に何をすべきか誰にも分からないことがあります。"},
      {"en":"Before scheduling a meeting, write one sentence that explains the purpose. For example, “We need to choose the launch date,” or “We need feedback on the first design.” This sentence helps people prepare. It also makes it easier to keep the conversation focused.","ja":"会議を設定する前に、目的を1文で書いてみましょう。たとえば「ローンチ日を決める必要がある」「最初のデザインについて意見が必要だ」といった形です。この1文があると、参加者は準備しやすくなります。また、会話の焦点も保ちやすくなります。"},
      {"en":"At the end, summarize the decision, the owner, and the deadline. A short meeting with a clear result is more valuable than a long meeting with many opinions. Good meetings do not need to feel formal. They need to help the team move forward.","ja":"最後に、決定事項、担当者、期限をまとめます。明確な結果がある短い会議は、多くの意見だけが残る長い会議より価値があります。良い会議は堅苦しい必要はありません。チームを前に進めることが大切です。"}
    ]$json$::jsonb,
    '["meeting","purpose","decision","feedback"]'::jsonb,
    2,
    216,
    130,
    '2026-05-03'
  ),
  (
    'local-news-heat-plan',
    'shadowing',
    'ニュース',
    'intermediate',
    '中級',
    'Cities Prepare for Hotter Summers',
    '暑い夏に備える都市の取り組み。',
    $json$[
      {"en":"Cities around the world are preparing for hotter summers. In some places, local governments are planting more trees, painting roofs in lighter colors, and creating public cooling spaces. These steps may look simple, but they can reduce heat in crowded neighborhoods.","ja":"世界中の都市が、より暑い夏に備えています。地域によっては、自治体が木を増やしたり、屋根を明るい色に塗ったり、公共の涼める場所を作ったりしています。これらの対策は単純に見えるかもしれませんが、密集した地域の暑さを和らげることができます。"},
      {"en":"Heat is not only uncomfortable. It can also be dangerous, especially for older people, outdoor workers, and families without air conditioning. Officials are now trying to share warnings earlier, so residents have more time to plan.","ja":"暑さは不快なだけではありません。特に高齢者、屋外で働く人、エアコンのない家庭にとっては危険にもなります。行政は現在、住民が早めに準備できるよう、警告をより早く共有しようとしています。"},
      {"en":"Experts say the best plans combine public information with physical changes to the city. A text alert can tell people what to do today. Trees, shade, and better buildings can make the next summer safer. The challenge is to act before the hottest days arrive.","ja":"専門家は、最善の対策は情報提供と都市そのものの改善を組み合わせることだと言います。通知メッセージは今日何をすべきかを知らせてくれます。一方で、木陰や建物の改善は次の夏をより安全にします。課題は、最も暑い日が来る前に行動することです。"}
    ]$json$::jsonb,
    '["prepare","reduce","resident","challenge"]'::jsonb,
    2,
    231,
    135,
    '2026-05-03'
  )
on conflict (id) do update set
  content_type = excluded.content_type,
  category = excluded.category,
  level = excluded.level,
  level_label = excluded.level_label,
  title = excluded.title,
  description = excluded.description,
  body = excluded.body,
  key_words = excluded.key_words,
  read_time_minutes = excluded.read_time_minutes,
  word_count = excluded.word_count,
  wpm = excluded.wpm,
  published_at = excluded.published_at,
  updated_at = now();
