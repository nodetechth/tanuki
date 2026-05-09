export type ListeningLevel = "beginner" | "intermediate" | "advanced";
export type ListeningContentType = "shadowing" | "listening";
export type ListeningAccent = "us" | "uk";

export type ListeningSentenceTiming = {
  start: number | null;
  end: number | null;
};

export type ListeningSentence = {
  id: string;
  en: string;
  ja: string;
  start: number | null;
  end: number | null;
  timings?: Partial<Record<ListeningAccent, ListeningSentenceTiming>>;
};

export type ListeningArticle = {
  id: string;
  contentType: ListeningContentType;
  category: string;
  level: ListeningLevel;
  levelLabel: string;
  date: string;
  title: string;
  description: string;
  readTimeMinutes: number;
  wordCount: number;
  wpm: number | null;
  liked: boolean;
  audioUrl: string | null;
  audioSources?: Partial<Record<ListeningAccent, string | null>>;
  paragraphs: Array<{
    en: string;
    ja: string;
    sentences?: ListeningSentence[];
  }>;
};

export const listeningArticles: ListeningArticle[] = [
  {
    id: "shadowing-lost-key",
    contentType: "shadowing",
    category: "生活",
    level: "beginner",
    levelLabel: "初級",
    date: "2026.05.04",
    title: "Finding a Lost Key",
    description: "落とし物を探す場面で、短く落ち着いて話す練習。",
    readTimeMinutes: 1,
    wordCount: 65,
    wpm: 115,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "I thought I lost my house key, so I checked my bag slowly. First, I looked in the front pocket. Then I checked under my notebook and behind my wallet. Finally, I found it inside my lunch bag. I felt relieved, and I reminded myself to choose one place for my key every day. Next time, I will check that place before I leave home.",
        ja: "家の鍵をなくしたと思ったので、かばんの中をゆっくり確認しました。まず前のポケットを見ました。次にノートの下と財布の後ろを確認しました。最後に、お弁当袋の中で見つけました。ほっとして、毎日鍵の置き場所を1つに決めようと思いました。次からは、家を出る前にその場所を確認します。",
      },
    ],
  },
  {
    id: "shadowing-status-update",
    contentType: "shadowing",
    category: "ビジネス",
    level: "intermediate",
    levelLabel: "中級",
    date: "2026.05.04",
    title: "A Quick Status Update",
    description: "進捗共有で、完了・課題・次の予定を簡潔に話す練習。",
    readTimeMinutes: 1,
    wordCount: 64,
    wpm: 130,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "Here is a quick update on the project. The design review is finished, and the team agreed on the main layout. We still need final copy for the pricing page, so I will ask marketing for that today. If we receive it by tomorrow morning, we can start testing the new flow in the afternoon. I will share the test results before Friday's meeting.",
        ja: "プロジェクトの簡単な進捗共有です。デザインレビューは完了し、チームは主要なレイアウトに合意しました。料金ページの最終文言がまだ必要なので、今日マーケティングに依頼します。明日の朝までに受け取れれば、午後に新しい導線のテストを始められます。金曜日の会議前にテスト結果を共有します。",
      },
    ],
  },
  {
    id: "shadowing-bike-lanes",
    contentType: "shadowing",
    category: "ニュース",
    level: "intermediate",
    levelLabel: "中級",
    date: "2026.05.04",
    title: "New Bike Lanes Open",
    description: "地域ニュースを自然なスピードで読む練習。",
    readTimeMinutes: 1,
    wordCount: 63,
    wpm: 135,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "The city opened two new bike lanes near the station this week. Officials say the lanes will make short trips safer and reduce traffic around the shopping area. Some drivers are worried about fewer parking spaces, but local shop owners hope more cyclists will stop by during lunch and after work. The city will review traffic data next month during the first week.",
        ja: "市は今週、駅の近くに新しい自転車レーンを2本開設しました。市の担当者は、短い移動がより安全になり、商店街周辺の交通量も減ると話しています。駐車スペースの減少を心配する運転者もいますが、地域の店主は昼休みや仕事帰りに立ち寄る自転車利用者が増えることを期待しています。市は来月の第1週に、交通データを確認する予定です。",
      },
    ],
  },
  {
    id: "shadowing-password-manager",
    contentType: "shadowing",
    category: "テクノロジー",
    level: "advanced",
    levelLabel: "上級",
    date: "2026.05.04",
    title: "A Password Manager Reminder",
    description: "セキュリティ習慣について、少し速めに説明する練習。",
    readTimeMinutes: 1,
    wordCount: 72,
    wpm: 145,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "A password manager is useful because it remembers strong passwords for you. Instead of using the same password on every website, you can create a different one for each account. It may feel like extra work at first, but it lowers the risk when one service has a data leak. Good security often starts with one simple habit. Turning on two-step verification makes that habit even stronger for everyone on the team.",
        ja: "パスワードマネージャーは、強いパスワードを代わりに覚えてくれるので便利です。すべてのサイトで同じパスワードを使う代わりに、アカウントごとに別のものを作れます。最初は手間に感じるかもしれませんが、1つのサービスで情報漏えいが起きたときのリスクを下げられます。良いセキュリティは、1つの簡単な習慣から始まることが多いです。二段階認証を有効にすると、チーム全員にとってその習慣はさらに強くなります。",
      },
    ],
  },
  {
    id: "shadowing-directions",
    contentType: "shadowing",
    category: "生活",
    level: "beginner",
    levelLabel: "初級",
    date: "2026.05.04",
    title: "Asking for Directions",
    description: "道をたずねる場面で、丁寧に短く話す練習。",
    readTimeMinutes: 1,
    wordCount: 53,
    wpm: 110,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "Excuse me, could you tell me how to get to the train station? I think I am close, but I am not sure which street to take. If I walk straight and turn left at the next corner, will I see the entrance? Thank you for your help. I really appreciate your directions.",
        ja: "すみません、駅への行き方を教えていただけますか。近くにいると思うのですが、どの道を行けばよいか分かりません。まっすぐ歩いて次の角を左に曲がれば、入口が見えますか。助けてくださってありがとうございます。道案内をしていただき、本当に助かります。",
      },
    ],
  },
  {
    id: "listening-city-library",
    contentType: "listening",
    category: "生活",
    level: "intermediate",
    levelLabel: "中級",
    date: "2026.05.04",
    title: "Why Local Libraries Still Matter",
    description: "地域の図書館が今も大切にされる理由。",
    readTimeMinutes: 2,
    wordCount: 274,
    wpm: null,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "When people think about libraries, they often imagine quiet rooms, old books, and students preparing for exams. Those images are not wrong, but modern libraries do much more than lend books. In many cities, the local library has become a practical public space where people can learn, work, and meet others without spending money.",
        ja: "図書館と聞くと、静かな部屋、古い本、試験勉強をする学生を思い浮かべる人が多いかもしれません。間違いではありませんが、現代の図書館は本を貸すだけではありません。多くの都市で、地域の図書館はお金をかけずに学び、働き、人と出会える実用的な公共スペースになっています。",
      },
      {
        en: "For families, libraries offer story events, children’s books, and a safe place to spend time after school. For adults, they provide internet access, job search support, language classes, and workshops about digital tools. These services are especially important for people who do not have a quiet home office or reliable access to technology.",
        ja: "家族にとっては、読み聞かせイベント、子ども向けの本、放課後に過ごせる安全な場所があります。大人にとっては、インターネット、仕事探しの支援、語学クラス、デジタルツールの講座などがあります。静かな仕事部屋や安定したテクノロジー環境がない人にとって、こうしたサービスは特に重要です。",
      },
      {
        en: "Libraries also help communities stay connected. A new resident can learn about local services. An older person can join a reading group and talk with neighbors. A student can ask a librarian how to find trustworthy information online. These small interactions may not look dramatic, but they build trust over time.",
        ja: "図書館は地域のつながりも支えます。引っ越してきた人は地域サービスを知ることができます。高齢者は読書会に参加して近所の人と話せます。学生は信頼できるオンライン情報の探し方を司書に聞けます。こうした小さな交流は派手ではありませんが、時間をかけて信頼を育てます。",
      },
      {
        en: "Another important role is helping people slow down. Unlike a cafe or a store, a library does not pressure visitors to buy something. Someone can sit for an hour, read a magazine, apply for a job, or simply think. In a busy city, that kind of open, quiet space is rare. It gives people room to focus without feeling watched or rushed.",
        ja: "もう1つの重要な役割は、人が少しペースを落とす助けになることです。カフェや店とは違い、図書館は利用者に何かを買うよう促しません。1時間座って雑誌を読む、仕事に応募する、ただ考える、といったことができます。忙しい都市では、そのような開かれた静かな場所は貴重です。見られている、急かされていると感じずに集中できる余白を与えてくれます。",
      },
      {
        en: "As more services move online, public places like libraries may become even more valuable. They remind us that access to knowledge should not depend only on income, age, or background. A library is not just a building full of books. It is a shared tool for learning how to live in a changing world.",
        ja: "多くのサービスがオンライン化するほど、図書館のような公共の場所はさらに価値を持つかもしれません。知識へのアクセスは、収入、年齢、背景だけに左右されるべきではないと教えてくれるからです。図書館は本が並ぶ建物ではなく、変化する世界で生きるために学ぶ共有の道具なのです。",
      },
    ],
  },
  {
    id: "listening-ai-customer-support",
    contentType: "listening",
    category: "ビジネス",
    level: "advanced",
    levelLabel: "上級",
    date: "2026.05.04",
    title: "AI and the Future of Customer Support",
    description: "AI導入で変わるカスタマーサポートの役割。",
    readTimeMinutes: 2,
    wordCount: 290,
    wpm: null,
    liked: false,
    audioUrl: null,
    paragraphs: [
      {
        en: "Customer support teams are under pressure to respond quickly while keeping service personal. AI tools can help with this challenge by answering common questions, summarizing long conversations, and suggesting next steps to human agents. For simple requests, such as checking delivery status or resetting a password, automation can reduce waiting time and improve the customer experience.",
        ja: "カスタマーサポートチームは、素早く対応しながらも個別性のあるサービスを保つ必要があります。AIツールは、よくある質問への回答、長い会話の要約、担当者への次の対応提案によって、この課題を支援できます。配送状況の確認やパスワード再設定のような簡単な依頼では、自動化が待ち時間を減らし、顧客体験を改善します。",
      },
      {
        en: "However, the goal should not be to remove people from support. Many customer problems include emotion, context, and judgment. A delayed order may be frustrating because it affects a birthday gift. A billing problem may matter because the customer has already contacted the company several times. In these situations, a human agent needs to listen carefully and make a decision that fits the case.",
        ja: "しかし、目的はサポートから人をなくすことではありません。多くの顧客課題には感情、背景、判断が含まれます。注文の遅れは誕生日プレゼントに影響するため不満につながるかもしれません。請求の問題は、顧客がすでに何度も問い合わせているため重要かもしれません。このような場面では、人間の担当者が丁寧に聞き、そのケースに合った判断をする必要があります。",
      },
      {
        en: "The strongest teams will probably use AI as a support layer. AI can prepare information before the conversation reaches a person. It can show past purchases, previous messages, and possible solutions. Then the agent can spend less time searching and more time solving the real problem. This changes the role of support from repeating answers to handling exceptions well.",
        ja: "最も強いチームは、おそらくAIを支援レイヤーとして使うでしょう。AIは会話が人間に届く前に情報を準備できます。過去の購入履歴、以前のメッセージ、解決策候補を表示できます。すると担当者は検索に使う時間を減らし、本当の問題解決に集中できます。これにより、サポートの役割は回答の繰り返しから、例外対応を上手に行うことへ変わります。",
      },
      {
        en: "Training will also become more important. Agents need to understand when to trust a suggestion and when to ignore it. A generated answer may be fast, but it may miss a detail in the customer's history. Teams should review difficult cases together, improve their prompts, and decide which situations must always be handled by a person.",
        ja: "研修もさらに重要になります。担当者は、提案を信頼すべき場面と無視すべき場面を理解する必要があります。生成された回答は速いかもしれませんが、顧客履歴の細かな点を見落とすことがあります。チームは難しいケースを一緒に振り返り、プロンプトを改善し、必ず人間が対応すべき状況を決めるべきです。",
      },
      {
        en: "For companies, the important question is not simply how much money AI can save. It is how to design a service flow where automation and human care work together. If customers feel that the company is hiding behind a bot, trust will fall. If AI makes good agents faster and better informed, trust can grow.",
        ja: "企業にとって重要な問いは、AIでどれだけ費用を削減できるかだけではありません。自動化と人間らしい配慮が一緒に機能するサービスフローをどう設計するかです。顧客が企業はボットの後ろに隠れていると感じれば、信頼は下がります。AIが優秀な担当者をより速く、より情報豊かにするなら、信頼は高まります。",
      },
    ],
  },
];
