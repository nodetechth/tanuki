alter table public.listening_articles
  add column if not exists content_type text not null default 'listening';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listening_articles_content_type_check'
  ) then
    alter table public.listening_articles
      add constraint listening_articles_content_type_check
      check (content_type in ('shadowing', 'listening'));
  end if;
end $$;

update public.listening_articles
set content_type = 'shadowing'
where id in (
  'morning-routine-reset',
  'meeting-with-clear-purpose',
  'local-news-heat-plan',
  'ai-tools-at-work',
  'coffee-shop-chat'
);

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
    'listening-city-library',
    'listening',
    '生活',
    'intermediate',
    '中級',
    'Why Local Libraries Still Matter',
    '地域の図書館が今も大切にされる理由。',
    $json$[
      {"en":"When people think about libraries, they often imagine quiet rooms, old books, and students preparing for exams. Those images are not wrong, but modern libraries do much more than lend books. In many cities, the local library has become a practical public space where people can learn, work, and meet others without spending money.","ja":"図書館と聞くと、静かな部屋、古い本、試験勉強をする学生を思い浮かべる人が多いかもしれません。間違いではありませんが、現代の図書館は本を貸すだけではありません。多くの都市で、地域の図書館はお金をかけずに学び、働き、人と出会える実用的な公共スペースになっています。"},
      {"en":"For families, libraries offer story events, children’s books, and a safe place to spend time after school. For adults, they provide internet access, job search support, language classes, and workshops about digital tools. These services are especially important for people who do not have a quiet home office or reliable access to technology.","ja":"家族にとっては、読み聞かせイベント、子ども向けの本、放課後に過ごせる安全な場所があります。大人にとっては、インターネット、仕事探しの支援、語学クラス、デジタルツールの講座などがあります。静かな仕事部屋や安定したテクノロジー環境がない人にとって、こうしたサービスは特に重要です。"},
      {"en":"Libraries also help communities stay connected. A new resident can learn about local services. An older person can join a reading group and talk with neighbors. A student can ask a librarian how to find trustworthy information online. These small interactions may not look dramatic, but they build trust over time.","ja":"図書館は地域のつながりも支えます。引っ越してきた人は地域サービスを知ることができます。高齢者は読書会に参加して近所の人と話せます。学生は信頼できるオンライン情報の探し方を司書に聞けます。こうした小さな交流は派手ではありませんが、時間をかけて信頼を育てます。"},
      {"en":"As more services move online, public places like libraries may become even more valuable. They remind us that access to knowledge should not depend only on income, age, or background. A library is not just a building full of books. It is a shared tool for learning how to live in a changing world.","ja":"多くのサービスがオンライン化するほど、図書館のような公共の場所はさらに価値を持つかもしれません。知識へのアクセスは、収入、年齢、背景だけに左右されるべきではないと教えてくれるからです。図書館は本が並ぶ建物ではなく、変化する世界で生きるために学ぶ共有の道具なのです。"}
    ]$json$::jsonb,
    '["library","public","community","access"]'::jsonb,
    3,
    392,
    130,
    '2026-05-04'
  ),
  (
    'listening-ai-customer-support',
    'listening',
    'ビジネス',
    'advanced',
    '上級',
    'AI and the Future of Customer Support',
    'AI導入で変わるカスタマーサポートの役割。',
    $json$[
      {"en":"Customer support teams are under pressure to respond quickly while keeping service personal. AI tools can help with this challenge by answering common questions, summarizing long conversations, and suggesting next steps to human agents. For simple requests, such as checking delivery status or resetting a password, automation can reduce waiting time and improve the customer experience.","ja":"カスタマーサポートチームは、素早く対応しながらも個別性のあるサービスを保つ必要があります。AIツールは、よくある質問への回答、長い会話の要約、担当者への次の対応提案によって、この課題を支援できます。配送状況の確認やパスワード再設定のような簡単な依頼では、自動化が待ち時間を減らし、顧客体験を改善します。"},
      {"en":"However, the goal should not be to remove people from support. Many customer problems include emotion, context, and judgment. A delayed order may be frustrating because it affects a birthday gift. A billing problem may matter because the customer has already contacted the company several times. In these situations, a human agent needs to listen carefully and make a decision that fits the case.","ja":"しかし、目的はサポートから人をなくすことではありません。多くの顧客課題には感情、背景、判断が含まれます。注文の遅れは誕生日プレゼントに影響するため不満につながるかもしれません。請求の問題は、顧客がすでに何度も問い合わせているため重要かもしれません。このような場面では、人間の担当者が丁寧に聞き、そのケースに合った判断をする必要があります。"},
      {"en":"The strongest teams will probably use AI as a support layer. AI can prepare information before the conversation reaches a person. It can show past purchases, previous messages, and possible solutions. Then the agent can spend less time searching and more time solving the real problem. This changes the role of support from repeating answers to handling exceptions well.","ja":"最も強いチームは、おそらくAIを支援レイヤーとして使うでしょう。AIは会話が人間に届く前に情報を準備できます。過去の購入履歴、以前のメッセージ、解決策候補を表示できます。すると担当者は検索に使う時間を減らし、本当の問題解決に集中できます。これにより、サポートの役割は回答の繰り返しから、例外対応を上手に行うことへ変わります。"},
      {"en":"For companies, the important question is not simply how much money AI can save. It is how to design a service flow where automation and human care work together. If customers feel that the company is hiding behind a bot, trust will fall. If AI makes good agents faster and better informed, trust can grow.","ja":"企業にとって重要な問いは、AIでどれだけ費用を削減できるかだけではありません。自動化と人間らしい配慮が一緒に機能するサービスフローをどう設計するかです。顧客が企業はボットの後ろに隠れていると感じれば、信頼は下がります。AIが優秀な担当者をより速く、より情報豊かにするなら、信頼は高まります。"}
    ]$json$::jsonb,
    '["support","automation","judgment","trust"]'::jsonb,
    3,
    431,
    145,
    '2026-05-04'
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

create index if not exists listening_articles_content_type_idx
  on public.listening_articles(content_type, category, level, published_at desc);
