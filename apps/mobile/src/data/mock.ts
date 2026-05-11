import type { Article, WordFolder } from "../types";

export const categories = ["ALL", "ビジネス", "ニュース", "生活", "テクノロジー"];

export const shadowingArticles: Article[] = [
  {
    id: "shadowing-directions",
    contentType: "shadowing",
    title: "Asking for Directions",
    description: "道をたずねる場面で、丁寧に短く話す練習。",
    category: "生活",
    level: "初級",
    duration: "1分",
    date: "2026.05.04",
    wpm: 110,
    isFavorite: true,
  },
  {
    id: "shadowing-customer-support",
    contentType: "shadowing",
    title: "A Quick Support Call",
    description: "問い合わせ対応で使う、落ち着いた英語表現。",
    category: "ビジネス",
    level: "中級",
    duration: "1分",
    date: "2026.05.05",
    wpm: 125,
    isCompleted: true,
  },
  {
    id: "shadowing-morning-routine",
    contentType: "shadowing",
    title: "A Morning Routine",
    description: "日常の流れを自然なリズムで話す練習。",
    category: "生活",
    level: "初級",
    duration: "1分",
    date: "2026.05.06",
    wpm: 115,
  },
];

export const listeningArticles: Article[] = [
  {
    id: "listening-library",
    contentType: "listening",
    title: "Why Local Libraries Still Matter",
    description: "地域の図書館が今も大切にされる理由。",
    category: "生活",
    level: "中級",
    duration: "3分",
    date: "2026.05.04",
    isFavorite: true,
  },
  {
    id: "listening-ai-support",
    contentType: "listening",
    title: "AI and the Future of Customer Support",
    description: "AI導入で変わるカスタマーサポートの役割。",
    category: "ビジネス",
    level: "上級",
    duration: "3分",
    date: "2026.05.04",
  },
  {
    id: "listening-power-banks",
    contentType: "listening",
    title: "Power Banks on Planes",
    description: "飛行機内のモバイルバッテリー利用を考える。",
    category: "ニュース",
    level: "中級",
    duration: "2分",
    date: "2026.05.05",
  },
];

export const wordFolders: WordFolder[] = [
  { id: "review", name: "復習リスト", count: 12 },
  { id: "favorite", name: "お気に入り", count: 4 },
  { id: "shadowing", name: "シャドーイング用復習単語", count: 8 },
];
