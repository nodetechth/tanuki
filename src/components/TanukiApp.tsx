"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookmarkPlus,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Folder,
  Heart,
  Headphones,
  Home,
  LogOut,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listeningArticles as fallbackListeningArticles } from "@/lib/listening-articles";
import type {
  ListeningArticle,
  ListeningAccent,
  ListeningSentence,
} from "@/lib/listening-articles";
import { materials } from "@/lib/materials";
import {
  getPracticeSource,
  getPracticeSourceFromSubmission,
  listeningArticleToPracticeSourceFromArticle,
} from "@/lib/practice-sources";
import type { PracticeSource, PracticeSourceType } from "@/lib/practice-sources";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { tutorProfiles } from "@/lib/tutors";
import type { TutorAvatarType, TutorId } from "@/lib/tutors";
import type { Material, SubmissionStatus, SubmissionWithFeedback } from "@/lib/types";
import type {
  WordEntry,
  WordLevel,
  WordPurpose,
} from "@/lib/word-dictionary/types";

type RecorderState = "idle" | "recording" | "recorded";
type RecorderMode = "practice" | "listening";
type AppTab = "home" | "speak" | "listening" | "search";
type SpeakView = "home" | "level" | "article" | "history";
type ArticleBackView = Exclude<SpeakView, "article">;
type ListeningTextMode = "both" | "english" | "japanese";
type ListeningWpmSort = "asc" | "desc";
type ListeningFeatureNotice = "speed" | "accent" | "saveFree" | "savePaid";
type AdminCompletionPreview = "actual" | "completed" | "open";

type ProblemWord = {
  word: string;
  reason: string;
};

type WordReviewStatus = "unreviewed" | "good" | "fair" | "bad";
type WordReviewFilter = WordReviewStatus;

type SavedWordEntry = {
  word: string;
  level: WordLevel;
  purpose: WordPurpose;
  savedAt: string;
  note?: string;
  status?: WordReviewStatus;
  lastReviewedAt?: string;
  reviewCount?: number;
  isArchived?: boolean;
};

type WordFolder = {
  id: string;
  name: string;
  words: SavedWordEntry[];
};

type WordReviewSession = {
  cards: SavedWordEntry[];
  index: number;
  revealed: boolean;
  results: Array<{
    word: string;
    status: Exclude<WordReviewStatus, "unreviewed">;
  }>;
  completed: boolean;
};

type ListeningArticleState = {
  articleId: string;
  favorite: boolean;
  readCompletedAt: string | null;
  shadowingCompletedAt: string | null;
  savedAt?: string | null;
  offlineSavedAt?: string | null;
  preferredAccent?: ListeningAccent | null;
};

type WordLookupNormalization = {
  input: string;
  headword: string;
  relation:
    | "past_tense"
    | "past_participle"
    | "present_participle"
    | "third_person_singular"
    | "plural"
    | "comparative"
    | "superlative"
    | "inflected";
  label: string;
};

type WordLookupCandidate = WordLookupNormalization & {
  definitionPreview: string;
};

type BillingState = {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  freeSubmissionUsed: boolean;
  completedSubmissionCount: number;
  todaySubscriberSubmissionCount: number;
  freeSubmissionsRemaining: number;
  dailySubmissionsRemaining: number;
  dailySubmissionLimit: number;
  canSubmit: boolean;
  isSubscriber: boolean;
  isAdmin: boolean;
  denialReason: string | null;
};

const statusLabels: Record<SubmissionStatus, string> = {
  uploaded: "アップロード完了",
  azure_processing: "発音を解析中",
  llm_processing: "フィードバック生成中",
  completed: "添削完了",
  failed: "失敗",
};

const footerTabs: Array<{
  id: AppTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "speak", label: "Speak", icon: Mic },
  { id: "listening", label: "Listening", icon: Headphones },
  { id: "search", label: "検索", icon: Search },
];

const listeningCategories = ["ALL", "ビジネス", "ニュース", "生活", "テクノロジー"];

const searchLevelOptions: Array<{
  id: WordLevel;
  label: string;
  description: string;
}> = [
  { id: "beginner", label: "初級", description: "A2〜B1 / TOEIC 400〜600" },
  { id: "intermediate", label: "中級", description: "B1〜B2 / TOEIC 600〜800" },
  { id: "advanced", label: "上級", description: "B2〜C1 / TOEIC 800〜" },
];

const searchPurposeOptions: Array<{
  id: WordPurpose;
  label: string;
  description: string;
}> = [
  { id: "casual", label: "カジュアル", description: "友人・家族・日常シーン" },
  { id: "business", label: "ビジネス", description: "会議・交渉・プレゼン" },
  { id: "toeic", label: "試験", description: "TOEIC / 資格出題傾向に沿った文体" },
];

const wordReviewStatusOptions: Array<{
  id: WordReviewStatus;
  label: string;
  mark: string;
}> = [
  { id: "unreviewed", label: "未学習", mark: "-" },
  { id: "good", label: "覚えた", mark: "○" },
  { id: "fair", label: "うろ覚え", mark: "△" },
  { id: "bad", label: "忘れた", mark: "×" },
];

function loadSearchPreferences() {
  const fallback: { level: WordLevel; purpose: WordPurpose } = {
    level: "intermediate",
    purpose: "business",
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem("tanuki-search-preferences");
  if (!saved) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved) as {
      level?: WordLevel;
      purpose?: WordPurpose;
    };
    return {
      level:
        parsed.level && searchLevelOptions.some((option) => option.id === parsed.level)
          ? parsed.level
          : fallback.level,
      purpose:
        parsed.purpose &&
        searchPurposeOptions.some((option) => option.id === parsed.purpose)
          ? parsed.purpose
          : fallback.purpose,
    };
  } catch {
    window.localStorage.removeItem("tanuki-search-preferences");
    return fallback;
  }
}

const defaultWordFolders: WordFolder[] = [
  { id: "review", name: "復習リスト", words: [] },
  { id: "favorites", name: "お気に入り", words: [] },
];

function normalizeWordLevel(value: unknown): WordLevel {
  return searchLevelOptions.some((option) => option.id === value)
    ? (value as WordLevel)
    : "intermediate";
}

function normalizeWordPurpose(value: unknown): WordPurpose {
  return searchPurposeOptions.some((option) => option.id === value)
    ? (value as WordPurpose)
    : "business";
}

function normalizeWordReviewStatus(value: unknown): WordReviewStatus {
  return wordReviewStatusOptions.some((option) => option.id === value)
    ? (value as WordReviewStatus)
    : "unreviewed";
}

function loadWordFolders(): WordFolder[] {
  if (typeof window === "undefined") {
    return defaultWordFolders;
  }

  try {
    const stored = window.localStorage.getItem("tanuki-word-folders");
    if (stored) {
      const parsed = JSON.parse(stored) as WordFolder[];
      const folders = parsed
        .map((folder) => ({
          id: String(folder.id || crypto.randomUUID()),
          name: String(folder.name || "単語フォルダ"),
          words: Array.isArray(folder.words)
            ? folder.words.map((entry) => ({
                word: String(entry.word ?? ""),
                level: normalizeWordLevel(entry.level),
                purpose: normalizeWordPurpose(entry.purpose),
                savedAt: String(entry.savedAt ?? new Date().toISOString()),
                note: typeof entry.note === "string" ? entry.note : undefined,
                status: normalizeWordReviewStatus(entry.status),
                lastReviewedAt:
                  typeof entry.lastReviewedAt === "string" ? entry.lastReviewedAt : undefined,
                reviewCount:
                  typeof entry.reviewCount === "number" && Number.isFinite(entry.reviewCount)
                    ? entry.reviewCount
                    : 0,
                isArchived: Boolean(entry.isArchived),
              }))
            : [],
        }))
        .filter((folder) => folder.id && folder.name);

      return folders.length ? folders : defaultWordFolders;
    }

    const legacyWords = JSON.parse(
      window.localStorage.getItem("tanuki-saved-words") ?? "[]",
    ) as string[];
    if (legacyWords.length) {
      return [
        {
          ...defaultWordFolders[0],
          words: legacyWords.map((word) => ({
            word,
            level: "intermediate",
            purpose: "business",
            savedAt: new Date().toISOString(),
            status: "unreviewed",
            reviewCount: 0,
            isArchived: false,
          })),
        },
        defaultWordFolders[1],
      ];
    }
  } catch {
    window.localStorage.removeItem("tanuki-word-folders");
  }

  return defaultWordFolders;
}

function loadCompletedListeningArticles() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    return new Set(
      JSON.parse(window.localStorage.getItem("tanuki-completed-listening") ?? "[]") as string[],
    );
  } catch {
    window.localStorage.removeItem("tanuki-completed-listening");
    return new Set<string>();
  }
}

function loadListeningAccent(): ListeningAccent {
  if (typeof window === "undefined") {
    return "us";
  }

  const accent = window.localStorage.getItem("tanuki-listening-accent");
  return accent === "uk" ? "uk" : "us";
}

function loadHiddenFailedSubmissionIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    return new Set(
      JSON.parse(
        window.localStorage.getItem("tanuki-hidden-failed-submissions") ?? "[]",
      ) as string[],
    );
  } catch {
    window.localStorage.removeItem("tanuki-hidden-failed-submissions");
    return new Set<string>();
  }
}

const wpmLevels = [
  { range: "WPM100", description: "ゆっくり明瞭、ネイティブの丁寧な発話" },
  { range: "110〜120", description: "ゆっくりな日常会話" },
  { range: "130〜140", description: "普通の会話速度" },
  { range: "150〜160", description: "自然なスピード" },
  { range: "170〜180", description: "ニュース・プレゼン速度" },
  { range: "190〜200", description: "ネイティブの速い会話" },
];

const listeningPlaybackRates = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
const listeningAccentOptions: Array<{
  id: ListeningAccent;
  label: string;
}> = [
  { id: "us", label: "アメリカ英語" },
  { id: "uk", label: "イギリス英語" },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatPlaybackRate(rate: number) {
  return `${rate.toFixed(1)}x`;
}

function authRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const currentOrigin = window.location.origin;

  if (configuredUrl && !configuredUrl.includes("localhost")) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (!currentOrigin.includes("localhost")) {
    return currentOrigin;
  }

  return configuredUrl?.replace(/\/$/, "") || currentOrigin;
}

function authErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("only request this after") ||
    normalizedMessage.includes("security purposes")
  ) {
    return {
      cooldownSeconds: 30,
      text: "安全のため、メール送信は30秒ほど間隔を空けてから再度お試しください。",
    };
  }

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return {
      cooldownSeconds: 60,
      text: "メール送信が短時間に集中しています。少し時間を置いてから再度お試しください。",
    };
  }

  return { cooldownSeconds: 0, text: message };
}

function getWordReviewStatus(entry: SavedWordEntry): WordReviewStatus {
  return entry.status ?? "unreviewed";
}

function getListeningSentences(article: ListeningArticle) {
  return article.paragraphs.flatMap((paragraph, paragraphIndex) =>
    getParagraphListeningSentences(article, paragraph, paragraphIndex),
  );
}

function getParagraphListeningSentences(
  article: ListeningArticle,
  paragraph: ListeningArticle["paragraphs"][number],
  paragraphIndex: number,
): ListeningSentence[] {
  return paragraph.sentences?.length
    ? paragraph.sentences
    : [
        {
          id: `${article.id}-p${paragraphIndex + 1}`,
          en: paragraph.en,
          ja: paragraph.ja,
          start: null,
          end: null,
        },
      ];
}

function audioUrlForListeningArticle(article: ListeningArticle, accent: ListeningAccent) {
  if (article.contentType !== "listening") {
    return article.audioUrl;
  }
  return article.audioSources?.[accent] ?? article.audioUrl;
}

function sentenceTimingForAccent(sentence: ListeningSentence, accent: ListeningAccent) {
  return sentence.timings?.[accent] ?? {
    start: sentence.start,
    end: sentence.end,
  };
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).format(date);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();

  return [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

function calculateStreak(loginDays: string[]) {
  const marked = new Set(loginDays);
  let cursor = new Date();
  let streak = 0;

  while (marked.has(dateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  return streak;
}

function monthKeyFromDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function compactMonthLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return `${Number(month)}月`;
}

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-amber-200";
  return "text-rose-200";
}

function overallScore(input: {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
}) {
  return Math.round(
    (input.accuracyScore + input.fluencyScore + input.completenessScore) / 3,
  );
}

function OverallScoreCard({
  score,
  accuracyScore,
  fluencyScore,
  completenessScore,
  detailsOpen,
  onToggleDetails,
}: {
  score: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const detailScores = [
    { label: "Accuracy", meaning: "正確さ", score: accuracyScore },
    { label: "Fluency", meaning: "流暢さ", score: fluencyScore },
    { label: "Completeness", meaning: "完成度", score: completenessScore },
  ];

  return (
    <div className="overall-score-card">
      <span>総合スコア</span>
      <strong className={scoreTone(score)}>{score}</strong>
      <div className="score-bar score-bar-large" aria-label={`総合スコア ${score}点`}>
        <i style={{ width: `${score}%` }} />
      </div>
      <button
        aria-expanded={detailsOpen}
        className="score-detail-toggle"
        onClick={onToggleDetails}
        type="button"
      >
        {detailsOpen ? "詳細を閉じる" : "詳細を見る"}
      </button>
      {detailsOpen ? (
        <div className="score-detail-panel">
          <p className="score-detail-note">
            総合スコアはAccuracy/Fluency/Completenessの平均です
          </p>
          <div className="score-detail-list">
            {detailScores.map((detail) => (
              <div className="score-detail-row" key={detail.label}>
                <span>
                  {detail.label}
                  <small>{detail.meaning}</small>
                </span>
                <strong>{detail.score}</strong>
                <div className="score-bar" aria-label={`${detail.label} ${detail.score}点`}>
                  <i style={{ width: `${detail.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScriptWithHighlights({
  text,
  problemWords,
}: {
  text: string;
  problemWords: ProblemWord[];
}) {
  const highlightedWords = new Set(
    (problemWords ?? []).map((item) => item.word.toLowerCase()),
  );
  const tokens = text.match(/\w+|[^\w\s]+|\s+/g) ?? [text];

  return (
    <p>
      {tokens.map((token, index) => {
        const normalized = token.toLowerCase();
        const shouldHighlight = highlightedWords.has(normalized);
        return shouldHighlight ? (
          <mark className="problem-word" key={`${token}-${index}`}>
            {token}
            <small>要練習</small>
          </mark>
        ) : (
          <span key={`${token}-${index}`}>{token}</span>
        );
      })}
    </p>
  );
}

function HighlightedSentence({
  sentence,
  word,
}: {
  sentence: string;
  word: string;
}) {
  const pattern = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = sentence.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <strong key={`${part}-${index}`}>{part}</strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function formatIpa(value: string) {
  const trimmed = value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed ? `/${trimmed}/` : "";
}

function cleanListeningWord(value: string) {
  return value.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").toLowerCase();
}

function normalizeSavedWord(value: string) {
  return value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function ListeningParagraph({
  text,
  onWordClick,
}: {
  text: string;
  onWordClick: (word: string) => void;
}) {
  const parts = text.match(/[A-Za-z]+(?:['-][A-Za-z]+)?|[^A-Za-z]+/g) ?? [text];

  return (
    <p className="listening-english-text">
      {parts.map((part, index) => {
        const word = cleanListeningWord(part);
        if (!word) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        return (
          <button
            key={`${part}-${index}`}
            onClick={(event) => {
              event.stopPropagation();
              onWordClick(word);
            }}
            type="button"
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function TutorAvatar({ type }: { type: TutorAvatarType }) {
  return (
    <span className={`tutor-avatar is-${type}`} aria-hidden="true">
      <span className="tutor-avatar-hair" />
      <span className="tutor-avatar-face">
        <span className="tutor-avatar-eye" />
        <span className="tutor-avatar-eye" />
        <span className="tutor-avatar-mouth" />
      </span>
    </span>
  );
}

function FeedbackPointSection({
  points,
  title,
  tone,
}: {
  points: string[];
  title: string;
  tone: "good" | "focus";
}) {
  const visiblePoints = points.slice(0, 2);
  const Icon = tone === "good" ? CheckCircle2 : Search;

  return (
    <section className={`feedback-point-panel is-${tone}`}>
      <div className="feedback-point-heading">
        <h3>
          {tone === "good" ? <Sparkles size={18} /> : <Search size={18} />}
          {title}
        </h3>
      </div>
      <div className="feedback-point-list">
        {visiblePoints.map((point) => (
          <article className="feedback-point-card" key={`${tone}-${point}`}>
            <div className="feedback-point-badges">
              <span className="feedback-point-chip">
                <Icon size={16} />
                {tone === "good" ? "Good" : "Focus"}
              </span>
            </div>
            <p>{point}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TanukiApp() {
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0].id);
  const [selectedSourceType, setSelectedSourceType] =
    useState<PracticeSourceType>("material");
  const [selectedSourceId, setSelectedSourceId] = useState(materials[0].id);
  const [selectedArticlePracticeSource, setSelectedArticlePracticeSource] =
    useState<PracticeSource | null>(null);
  const selectedMaterial = useMemo(
    () => {
      if (
        selectedSourceType === "listening_article" &&
        selectedArticlePracticeSource?.sourceId === selectedSourceId
      ) {
        return selectedArticlePracticeSource;
      }

      return (
        getPracticeSource(selectedSourceType, selectedSourceId) ??
        getPracticeSource("material", selectedMaterialId) ??
        getPracticeSource("material", materials[0].id)!
      );
    },
    [
      selectedArticlePracticeSource,
      selectedMaterialId,
      selectedSourceId,
      selectedSourceType,
    ],
  );
  const [, setSelectedTutorId] = useState<TutorId>(tutorProfiles[0].id);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recorderMode, setRecorderMode] = useState<RecorderMode>("practice");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submission, setSubmission] = useState<SubmissionWithFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [history, setHistory] = useState<SubmissionWithFeedback[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authCooldownSeconds, setAuthCooldownSeconds] = useState(0);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [adminTestMode, setAdminTestMode] = useState(false);
  const [adminCompletionPreview, setAdminCompletionPreview] =
    useState<AdminCompletionPreview>("actual");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [tutorSubmitOpen, setTutorSubmitOpen] = useState(false);
  const [searchLevel, setSearchLevel] = useState<WordLevel>(
    () => loadSearchPreferences().level,
  );
  const [searchPurpose, setSearchPurpose] = useState<WordPurpose>(
    () => loadSearchPreferences().purpose,
  );
  const [activeTab, setActiveTab] = useState<AppTab>("speak");
  const [speakView, setSpeakView] = useState<SpeakView>("home");
  const [, setArticleBackView] = useState<ArticleBackView>("home");
  const [articlePracticeOpen, setArticlePracticeOpen] = useState(true);
  const [scoreDetailsOpen, setScoreDetailsOpen] = useState(false);
  const [selectedWpmRange] = useState(wpmLevels[0].range);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [loginDays, setLoginDays] = useState<string[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [listeningCategory, setListeningCategory] = useState("ALL");
  const [shadowingCategory, setShadowingCategory] = useState("ALL");
  const [listeningArticles, setListeningArticles] = useState<ListeningArticle[]>(
    fallbackListeningArticles,
  );
  const [selectedListeningArticleId, setSelectedListeningArticleId] = useState<string | null>(
    null,
  );
  const [listeningDetailBackTab, setListeningDetailBackTab] =
    useState<AppTab>("listening");
  const [listeningTextMode, setListeningTextMode] = useState<ListeningTextMode>("both");
  const [listeningFavoritesFirst, setListeningFavoritesFirst] = useState(false);
  const [shadowingFavoritesFirst, setShadowingFavoritesFirst] = useState(false);
  const [listeningWpmSort] = useState<ListeningWpmSort>("asc");
  const [listeningPlaybackRate, setListeningPlaybackRate] = useState(1);
  const [listeningAccent, setListeningAccent] = useState<ListeningAccent>(
    () => loadListeningAccent(),
  );
  const [, setListeningPlaybackProgress] = useState(0);
  const [activeListeningSentenceId, setActiveListeningSentenceId] = useState<string | null>(null);
  const [listeningFeatureNotice, setListeningFeatureNotice] =
    useState<ListeningFeatureNotice | null>(null);
  const [selectedListeningWord, setSelectedListeningWord] = useState<string | null>(null);
  const [completedListeningArticles, setCompletedListeningArticles] = useState<Set<string>>(
    () => loadCompletedListeningArticles(),
  );
  const [listeningArticleStates, setListeningArticleStates] = useState<
    ListeningArticleState[]
  >([]);
  const [likedListeningArticles, setLikedListeningArticles] = useState<Set<string>>(
    () =>
      new Set(
        fallbackListeningArticles
          .filter((article) => article.liked)
          .map((article) => article.id),
      ),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [wordResult, setWordResult] = useState<WordEntry | null>(null);
  const [wordLookup, setWordLookup] = useState<WordLookupNormalization | null>(null);
  const [wordLookupCandidates, setWordLookupCandidates] = useState<WordLookupCandidate[]>([]);
  const [missingWordQuery, setMissingWordQuery] = useState("");
  const [missingWordSaveMessage, setMissingWordSaveMessage] = useState<string | null>(null);
  const [wordMemo, setWordMemo] = useState("");
  const [wordMemoMessage, setWordMemoMessage] = useState<string | null>(null);
  const [wordSearchLoading, setWordSearchLoading] = useState(false);
  const [wordSearchError, setWordSearchError] = useState<string | null>(null);
  const [wordFolders, setWordFolders] = useState<WordFolder[]>(() => loadWordFolders());
  const [selectedWordFolderId, setSelectedWordFolderId] = useState("review");
  const [openWordFolderId, setOpenWordFolderId] = useState<string | null>(null);
  const [folderGridEditing, setFolderGridEditing] = useState(false);
  const [folderWordEditing, setFolderWordEditing] = useState(false);
  const [selectedFolderWordKeys, setSelectedFolderWordKeys] = useState<Set<string>>(new Set());
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<WordFolder | null>(null);
  const [folderEditModal, setFolderEditModal] = useState<WordFolder | null>(null);
  const [folderDraftName, setFolderDraftName] = useState("");
  const [folderActionMessage, setFolderActionMessage] = useState<string | null>(null);
  const [wordReviewFilters, setWordReviewFilters] = useState<Set<WordReviewFilter>>(new Set());
  const [wordReviewSession, setWordReviewSession] = useState<WordReviewSession | null>(null);
  const [wordReviewDetails, setWordReviewDetails] = useState<Record<string, WordEntry | null>>({});
  const [saveWordModalOpen, setSaveWordModalOpen] = useState(false);
  const [removeWordModalOpen, setRemoveWordModalOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [selectedWeakWords, setSelectedWeakWords] = useState<Set<string>>(new Set());
  const [weakWordSaveMessage, setWeakWordSaveMessage] = useState<string | null>(null);
  const [hiddenFailedSubmissionIds, setHiddenFailedSubmissionIds] = useState<Set<string>>(
    () => loadHiddenFailedSubmissionIds(),
  );
  const [errorDetailSubmission, setErrorDetailSubmission] =
    useState<SubmissionWithFeedback | null>(null);
  const [errorCodeCopied, setErrorCodeCopied] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const listeningAudioRef = useRef<HTMLAudioElement | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const startedAtRef = useRef<number>(0);
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    if (authCooldownSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setAuthCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authCooldownSeconds]);

  useEffect(() => {
    if (recorderState !== "recording") {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 200);

    return () => window.clearInterval(timer);
  }, [recorderState]);

  useEffect(() => {
    void loadListeningArticles();
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (authUser) {
      const storageKey = `tanuki-login-days-${authUser.id}`;
      const today = dateKey(new Date());
      const storedDays = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "[]",
      ) as string[];
      const nextDays = Array.from(new Set([...storedDays, today])).sort();
      window.localStorage.setItem(storageKey, JSON.stringify(nextDays));
      window.setTimeout(() => setLoginDays(nextDays), 0);
      loadHistory();
      loadBilling();
      loadListeningStates();
      syncCheckoutIfNeeded();
    } else {
      window.setTimeout(() => setLoginDays([]), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser || !billing?.isAdmin) {
      window.setTimeout(() => {
        setAdminTestMode(false);
        setAdminCompletionPreview("actual");
      }, 0);
      return;
    }

    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTestMode, authUser?.id, billing?.isAdmin]);

  useEffect(() => {
    window.localStorage.setItem(
      "tanuki-search-preferences",
      JSON.stringify({ level: searchLevel, purpose: searchPurpose }),
    );
  }, [searchLevel, searchPurpose]);

  useEffect(() => {
    window.localStorage.setItem("tanuki-word-folders", JSON.stringify(wordFolders));
  }, [wordFolders]);

  useEffect(() => {
    const entry = wordReviewSession?.cards[wordReviewSession.index];
    const key = entry ? normalizeSavedWord(entry.word) : "";
    if (!entry || !key || !wordReviewSession.revealed || key in wordReviewDetails) {
      return;
    }

    let cancelled = false;
    const reviewWord = entry.word;
    async function loadReviewWord() {
      const word = await fetchWordEntryForReview(reviewWord);
      if (!cancelled) {
        setWordReviewDetails((current) => ({
          ...current,
          [key]: word,
        }));
      }
    }

    void loadReviewWord();
    return () => {
      cancelled = true;
    };
  }, [wordReviewDetails, wordReviewSession]);

  useEffect(() => {
    window.localStorage.setItem(
      "tanuki-hidden-failed-submissions",
      JSON.stringify(Array.from(hiddenFailedSubmissionIds)),
    );
  }, [hiddenFailedSubmissionIds]);

  useEffect(() => {
    const problemWords = submission?.feedback?.problemWords ?? [];
    const timer = window.setTimeout(() => {
      setSelectedWeakWords(new Set(problemWords.map((item) => normalizeSavedWord(item.word))));
      setWeakWordSaveMessage(null);
      setScoreDetailsOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [submission?.id, submission?.feedback?.problemWords]);

  useEffect(() => {
    window.localStorage.setItem(
      "tanuki-completed-listening",
      JSON.stringify(Array.from(completedListeningArticles)),
    );
  }, [completedListeningArticles]);

  useEffect(() => {
    window.localStorage.setItem("tanuki-listening-accent", listeningAccent);
  }, [listeningAccent]);

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  async function startRecording(mode: RecorderMode) {
    setError(null);
    setSubmissionNotice(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    pcmChunksRef.current = [];
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecorderMode(mode);

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    audioContextRef.current = audioContext;
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      pcmChunksRef.current.push(new Float32Array(input));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    setRecorderState("recording");
  }

  async function stopRecording() {
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const audioContext = audioContextRef.current;
    const sampleRate = audioContext?.sampleRate ?? 44100;
    await audioContext?.close();

    const blob = encodeWav(pcmChunksRef.current, sampleRate);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(blob);
    setRecordedUrl(URL.createObjectURL(blob));
    setRecorderState("recorded");
  }

  function resetRecording({ clearSubmission = true }: { clearSubmission?: boolean } = {}) {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setRecorderState("idle");
    if (clearSubmission) {
      setSubmission(null);
    }
    setError(null);
  }

  function selectPracticeSource(sourceType: PracticeSourceType, sourceId: string) {
    setSelectedSourceType(sourceType);
    setSelectedSourceId(sourceId);
    if (sourceType !== "listening_article") {
      setSelectedArticlePracticeSource(null);
    }
    if (sourceType === "material") {
      setSelectedMaterialId(sourceId);
    }
  }

  function playMaterial(material: Material) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(material.scriptText);
    utterance.lang = "en-US";
    utterance.rate = material.level === "advanced" ? 0.94 : 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function speakEnglish(text: string) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  function speechRateForListeningArticle(article: ListeningArticle, playbackRate = listeningPlaybackRate) {
    const baseRate =
      article.level === "beginner" ? 0.82 : article.level === "intermediate" ? 0.9 : 0.96;
    return Math.min(1.5, Math.max(0.1, baseRate * playbackRate));
  }

  function speakListeningText(article: ListeningArticle, text: string, playbackRate = listeningPlaybackRate) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveListeningAccent === "uk" ? "en-GB" : "en-US";
    utterance.rate = speechRateForListeningArticle(article, playbackRate);
    window.speechSynthesis.speak(utterance);
  }

  function playListeningArticle(article: ListeningArticle, playbackRate = listeningPlaybackRate) {
    window.speechSynthesis.cancel();
    const audio = listeningAudioRef.current;
    if (
      article.contentType === "listening" &&
      audioUrlForListeningArticle(article, effectiveListeningAccent) &&
      audio
    ) {
      audio.playbackRate = playbackRate;
      void audio.play();
      return;
    }

    speakListeningText(
      article,
      article.paragraphs.map((paragraph) => paragraph.en).join("\n\n"),
      playbackRate,
    );
  }

  function stopListeningArticle() {
    window.speechSynthesis.cancel();
    const audio = listeningAudioRef.current;
    if (audio) {
      audio.pause();
    }
  }

  function playListeningSentence(article: ListeningArticle, sentence: ListeningSentence) {
    window.speechSynthesis.cancel();
    setActiveListeningSentenceId(sentence.id);
    const audio = listeningAudioRef.current;
    const timing = sentenceTimingForAccent(sentence, effectiveListeningAccent);
    if (
      article.contentType === "listening" &&
      audioUrlForListeningArticle(article, effectiveListeningAccent) &&
      audio &&
      typeof timing.start === "number"
    ) {
      audio.currentTime = timing.start;
      audio.playbackRate = listeningPlaybackRate;
      void audio.play();
      return;
    }

    speakListeningText(article, sentence.en);
  }

  function updateListeningAudioProgress(article: ListeningArticle) {
    const audio = listeningAudioRef.current;
    if (!audio) {
      return;
    }

    setListeningPlaybackProgress(
      audio.duration ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0,
    );

    const activeSentence = getListeningSentences(article).find(
      (sentence) => {
        const timing = sentenceTimingForAccent(sentence, effectiveListeningAccent);
        return (
          typeof timing.start === "number" &&
          typeof timing.end === "number" &&
          audio.currentTime >= timing.start &&
          audio.currentTime < timing.end
        );
      },
    );
    setActiveListeningSentenceId(activeSentence?.id ?? null);
  }

  function canUseListeningPremiumFeature() {
    return Boolean(billing?.isSubscriber || billing?.isAdmin);
  }

  function selectListeningAccent(accent: ListeningAccent) {
    if (accent === effectiveListeningAccent) {
      return;
    }
    if (!canUseListeningPremiumFeature()) {
      setListeningFeatureNotice("accent");
      return;
    }

    stopListeningArticle();
    setActiveListeningSentenceId(null);
    setListeningPlaybackProgress(0);
    setListeningAccent(accent);
    if (selectedListeningArticle) {
      void saveListeningState({
        articleId: selectedListeningArticle.id,
        preferredAccent: accent,
      });
    }
  }

  function changeListeningPlaybackRate(direction: -1 | 1) {
    if (!canUseListeningPremiumFeature()) {
      setListeningFeatureNotice("speed");
      return;
    }

    const currentIndex = listeningPlaybackRates.findIndex((rate) => rate === listeningPlaybackRate);
    const nextIndex = Math.max(
      0,
      Math.min(listeningPlaybackRates.length - 1, currentIndex + direction),
    );
    const nextRate = listeningPlaybackRates[nextIndex] ?? 1;
    setListeningPlaybackRate(nextRate);
    if (listeningAudioRef.current) {
      listeningAudioRef.current.playbackRate = nextRate;
    }

    if (selectedListeningArticle && window.speechSynthesis.speaking && nextRate !== listeningPlaybackRate) {
      playListeningArticle(selectedListeningArticle, nextRate);
    }
  }

  function openListeningSaveNotice() {
    setListeningFeatureNotice(canUseListeningPremiumFeature() ? "savePaid" : "saveFree");
  }

  async function loadListeningArticles() {
    const response = await fetch("/api/listening/articles");
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { articles: ListeningArticle[] };
    if (!data.articles.length) {
      return;
    }

    setListeningArticles(data.articles);
    setLikedListeningArticles((current) => {
      const next = new Set(current);
      data.articles.forEach((article) => {
        if (article.liked) next.add(article.id);
      });
      return next;
    });
  }

  function toggleListeningLike(articleId: string) {
    setLikedListeningArticles((current) => {
      const next = new Set(current);
      const favorite = !next.has(articleId);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      void saveListeningState({ articleId, favorite });
      return next;
    });
  }

  async function loadListeningStates() {
    const response = await fetch("/api/listening/state", {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { states: ListeningArticleState[] };
    setListeningArticleStates(data.states);
    setLikedListeningArticles((current) => {
      const next = new Set(current);
      data.states.forEach((state) => {
        if (state.favorite) next.add(state.articleId);
      });
      return next;
    });
    setCompletedListeningArticles((current) => {
      const next = new Set(current);
      data.states.forEach((state) => {
        if (state.readCompletedAt) next.add(state.articleId);
      });
      return next;
    });
  }

  async function saveListeningState(input: {
    articleId: string;
    readCompleted?: boolean;
    favorite?: boolean;
    saved?: boolean;
    offlineSaved?: boolean;
    preferredAccent?: ListeningAccent | null;
  }) {
    if (!authUser) {
      return;
    }

    await fetch("/api/listening/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify(input),
    });
  }

  function startShadowingArticle(article: ListeningArticle) {
    setSelectedArticlePracticeSource(listeningArticleToPracticeSourceFromArticle(article));
    setCompletedListeningArticles((current) => new Set([...current, article.id]));
    void saveListeningState({ articleId: article.id, readCompleted: true });
    selectPracticeSource("listening_article", article.id);
    resetRecording();
    setArticleBackView("home");
    setArticlePracticeOpen(true);
    setSelectedListeningWord(null);
    setActiveTab("speak");
    setSpeakView("article");
    window.speechSynthesis.cancel();
  }

  function openSubmissionFromHistory(
    item: SubmissionWithFeedback,
    source: ReturnType<typeof getPracticeSourceFromSubmission>,
    backView: ArticleBackView,
  ) {
    if (!source) {
      return;
    }

    selectPracticeSource(source.sourceType, source.sourceId);
    resetRecording();
    setSubmission(item);
    setArticleBackView(backView);
    setArticlePracticeOpen(false);
    setSpeakView("article");
  }

  function showRepeatPractice() {
    if (!canSubmitToday) {
      return;
    }
    resetRecording({ clearSubmission: false });
    setArticlePracticeOpen(true);
  }

  function resetWordSearchState() {
    setWordResult(null);
    setWordLookup(null);
    setWordLookupCandidates([]);
    setMissingWordQuery("");
    setMissingWordSaveMessage(null);
    setWordMemo("");
    setWordMemoMessage(null);
    setWordSearchError(null);
  }

  async function loadWord(query: string, candidate?: Pick<WordLookupCandidate, "headword" | "relation">) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setWordSearchError("検索する単語を入力してください。");
      return;
    }

    setWordSearchLoading(true);
    setWordSearchError(null);
    try {
      const params = new URLSearchParams({ word: normalizedQuery });
      if (candidate) {
        params.set("headword", candidate.headword);
        params.set("relation", candidate.relation);
      }
      const response = await fetch(`/api/words?${params.toString()}`);
      const payload = (await response.json()) as {
        status?: "single" | "candidates" | "missing";
        word?: WordEntry;
        lookup?: WordLookupNormalization | null;
        candidates?: WordLookupCandidate[];
        query?: string;
        error?: string;
      };
      if (response.ok && payload.status === "candidates" && payload.candidates?.length) {
        setWordResult(null);
        setWordLookup(null);
        setWordLookupCandidates(payload.candidates);
        setMissingWordQuery("");
        setMissingWordSaveMessage(null);
        setWordMemo("");
        setWordMemoMessage(null);
        setWordSearchError(null);
        return;
      }
      if (!response.ok || !payload.word) {
        const missingWord = normalizeSavedWord(normalizedQuery);
        setWordResult(null);
        setWordLookup(null);
        setWordLookupCandidates([]);
        setMissingWordQuery(missingWord);
        setMissingWordSaveMessage(null);
        setWordMemo("");
        setWordMemoMessage(null);
        setWordSearchError(null);
        if (missingWord) {
          void requestMissingWord(missingWord);
        }
        return;
      }
      setWordResult(payload.word);
      setWordLookup(payload.lookup ?? null);
      setWordLookupCandidates([]);
      setMissingWordQuery("");
      setMissingWordSaveMessage(null);
      setSearchTerm(payload.word.word);
      const targetWord = normalizeSavedWord(payload.word.word);
      const savedEntry = wordFolders
        .flatMap((folder) => folder.words)
        .find((entry) => normalizeSavedWord(entry.word) === targetWord);
      setWordMemo(savedEntry?.note ?? "");
      setWordMemoMessage(null);
    } catch {
      setWordSearchError("単語検索に失敗しました。");
    } finally {
      setWordSearchLoading(false);
    }
  }

  async function searchWord(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await loadWord(searchTerm);
  }

  async function fetchWordEntryForReview(word: string) {
    const normalizedWord = normalizeSavedWord(word);
    if (!normalizedWord) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        word: normalizedWord,
        headword: normalizedWord,
        relation: "exact",
      });
      const response = await fetch(`/api/words?${params.toString()}`);
      const payload = (await response.json()) as {
        status?: "single" | "candidates" | "missing";
        word?: WordEntry;
      };
      return response.ok && payload.status === "single" && payload.word ? payload.word : null;
    } catch {
      return null;
    }
  }

  async function requestMissingWord(word: string) {
    await fetch("/api/word-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ word }),
    });
  }

  function saveMissingWordToFolder(folderId: string) {
    const normalizedWord = normalizeSavedWord(missingWordQuery);
    if (!normalizedWord) {
      return;
    }

    const entry: SavedWordEntry = {
      word: normalizedWord,
      level: searchLevel,
      purpose: searchPurpose,
      savedAt: new Date().toISOString(),
      note: "",
      status: "unreviewed",
      reviewCount: 0,
      isArchived: false,
    };

    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words:
          folder.id === folderId
            ? [
                entry,
                ...folder.words.filter(
                  (item) => normalizeSavedWord(item.word) !== normalizedWord,
                ),
              ]
            : folder.words.filter((item) => normalizeSavedWord(item.word) !== normalizedWord),
      })),
    );
    setSelectedWordFolderId(folderId);
    const folderName =
      wordFolders.find((folder) => folder.id === folderId)?.name ?? "選択したフォルダ";
    setMissingWordSaveMessage(`「${normalizedWord}」を${folderName}に保存しました。`);
  }

  function saveWordToFolder(folderId: string) {
    if (!wordResult) {
      return;
    }

    const normalizedWord = normalizeSavedWord(wordResult.word);
    const existingEntry = wordFolders
      .flatMap((folder) => folder.words)
      .find((entry) => normalizeSavedWord(entry.word) === normalizedWord);
    const entry: SavedWordEntry = {
      word: normalizedWord || wordResult.word,
      level: searchLevel,
      purpose: searchPurpose,
      savedAt: new Date().toISOString(),
      note: wordMemo.trim(),
      status: existingEntry?.status ?? "unreviewed",
      lastReviewedAt: existingEntry?.lastReviewedAt,
      reviewCount: existingEntry?.reviewCount ?? 0,
      isArchived: existingEntry?.isArchived ?? false,
    };

    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words:
          folder.id === folderId
            ? [
                entry,
                ...folder.words.filter(
                  (item) => normalizeSavedWord(item.word) !== normalizedWord,
                ),
              ]
            : folder.words.filter((item) => normalizeSavedWord(item.word) !== normalizedWord),
      })),
    );
    setSelectedWordFolderId(folderId);
    setSaveWordModalOpen(false);
  }

  function updateCurrentSavedWordMemo() {
    if (!wordResult) {
      return;
    }

    const targetWord = normalizeSavedWord(wordResult.word);
    const savedAt = new Date().toISOString();
    let updated = false;
    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words: folder.words.map((entry) =>
          normalizeSavedWord(entry.word) === targetWord
            ? (() => {
                updated = true;
                return {
                  ...entry,
                  level: searchLevel,
                  purpose: searchPurpose,
                  note: wordMemo.trim(),
                  savedAt,
                };
              })()
            : entry,
        ),
      })),
    );
    setWordMemoMessage(
      updated ? "単語メモを更新しました。" : "保存済み単語が見つかりませんでした。",
    );
  }

  function saveWeakWordsToFolder(folderId: string, problemWords: ProblemWord[]) {
    const selectedEntries = problemWords
      .map((item) => ({
        item,
        key: normalizeSavedWord(item.word),
      }))
      .filter(({ key }) => key && selectedWeakWords.has(key));

    if (!selectedEntries.length) {
      setWeakWordSaveMessage("保存する単語を選択してください。");
      return;
    }

    const savedAt = new Date().toISOString();
    const entries: SavedWordEntry[] = selectedEntries.map(({ item, key }) => ({
      ...(() => {
        const existingEntry = wordFolders
          .flatMap((folder) => folder.words)
          .find((entry) => normalizeSavedWord(entry.word) === key);
        return {
          word: key || item.word,
          level: searchLevel,
          purpose: searchPurpose,
          savedAt,
          note: item.reason,
          status: existingEntry?.status ?? "unreviewed",
          lastReviewedAt: existingEntry?.lastReviewedAt,
          reviewCount: existingEntry?.reviewCount ?? 0,
          isArchived: existingEntry?.isArchived ?? false,
        };
      })(),
    }));
    const entryKeys = new Set(entries.map((entry) => normalizeSavedWord(entry.word)));

    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words:
          folder.id === folderId
            ? [
                ...entries,
                ...folder.words.filter(
                  (entry) => !entryKeys.has(normalizeSavedWord(entry.word)),
                ),
              ]
            : folder.words.filter((entry) => !entryKeys.has(normalizeSavedWord(entry.word))),
      })),
    );

    setSelectedWordFolderId(folderId);
    setWeakWordSaveMessage(`${entries.length}件の苦手な単語をメモ付きで保存しました。`);
  }

  function removeCurrentSavedWord() {
    if (!wordResult) {
      return;
    }

    const targetWord = normalizeSavedWord(wordResult.word);
    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words: folder.words.filter(
          (entry) => normalizeSavedWord(entry.word) !== targetWord,
        ),
      })),
    );
    setRemoveWordModalOpen(false);
  }

  function wordEntryKey(entry: SavedWordEntry) {
    return normalizeSavedWord(entry.word);
  }

  function moveWordFolder(folderId: string, direction: -1 | 1) {
    setWordFolders((current) => {
      const index = current.findIndex((folder) => folder.id === folderId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function deleteWordFolder(folderId: string) {
    if (wordFolders.length <= 1) {
      setFolderActionMessage("最後の1フォルダは削除できません。");
      setFolderToDelete(null);
      return;
    }

    setWordFolders((current) => current.filter((folder) => folder.id !== folderId));
    if (selectedWordFolderId === folderId) {
      const fallback = wordFolders.find((folder) => folder.id !== folderId);
      setSelectedWordFolderId(fallback?.id ?? "review");
    }
    if (openWordFolderId === folderId) {
      setOpenWordFolderId(null);
    }
    setFolderToDelete(null);
    setFolderEditModal(null);
    setSelectedFolderWordKeys(new Set());
    setFolderActionMessage("フォルダを削除しました。");
  }

  function openFolderEditModal(folder: WordFolder) {
    setFolderEditModal(folder);
    setFolderDraftName(folder.name);
    setFolderActionMessage(null);
  }

  function renameWordFolder() {
    if (!folderEditModal) {
      return;
    }

    const name = folderDraftName.trim();
    const normalizedName = name.toLocaleLowerCase("ja-JP");
    if (!name) {
      setFolderActionMessage("フォルダ名を入力してください。");
      return;
    }
    if (
      wordFolders.some(
        (folder) =>
          folder.id !== folderEditModal.id &&
          folder.name.trim().toLocaleLowerCase("ja-JP") === normalizedName,
      )
    ) {
      setFolderActionMessage("同じ名前のフォルダがあります。");
      return;
    }

    setWordFolders((current) =>
      current.map((folder) =>
        folder.id === folderEditModal.id ? { ...folder, name } : folder,
      ),
    );
    setFolderEditModal(null);
    setFolderActionMessage("フォルダ名を更新しました。");
  }

  function toggleFolderWordSelection(entry: SavedWordEntry) {
    const key = wordEntryKey(entry);
    setSelectedFolderWordKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function moveSelectedFolderWords() {
    const sourceFolderId = openWordFolder?.id;
    const targetFolderId =
      bulkMoveFolderId || wordFolders.find((folder) => folder.id !== sourceFolderId)?.id || "";
    if (!sourceFolderId || !targetFolderId || sourceFolderId === targetFolderId) {
      setFolderActionMessage("移動先フォルダを選択してください。");
      return;
    }

    const sourceFolder = wordFolders.find((folder) => folder.id === sourceFolderId);
    const targetFolder = wordFolders.find((folder) => folder.id === targetFolderId);
    if (!sourceFolder || !targetFolder || !selectedFolderWordKeys.size) {
      return;
    }

    const movingWords = sourceFolder.words.filter((entry) =>
      selectedFolderWordKeys.has(wordEntryKey(entry)),
    );
    const movingKeys = new Set(movingWords.map((entry) => wordEntryKey(entry)));
    setWordFolders((current) =>
      current.map((folder) => {
        if (folder.id === sourceFolderId) {
          return {
            ...folder,
            words: folder.words.filter((entry) => !movingKeys.has(wordEntryKey(entry))),
          };
        }
        if (folder.id === targetFolderId) {
          return {
            ...folder,
            words: [
              ...movingWords,
              ...folder.words.filter((entry) => !movingKeys.has(wordEntryKey(entry))),
            ],
          };
        }
        return folder;
      }),
    );
    setSelectedFolderWordKeys(new Set());
    setFolderActionMessage(`${movingWords.length}件を${targetFolder.name}へ移動しました。`);
  }

  function deleteSelectedFolderWords() {
    const sourceFolderId = openWordFolder?.id;
    if (!sourceFolderId || !selectedFolderWordKeys.size) {
      return;
    }

    const count = selectedFolderWordKeys.size;
    setWordFolders((current) =>
      current.map((folder) =>
        folder.id === sourceFolderId
          ? {
              ...folder,
              words: folder.words.filter(
                (entry) => !selectedFolderWordKeys.has(wordEntryKey(entry)),
              ),
            }
          : folder,
      ),
    );
    setSelectedFolderWordKeys(new Set());
    setFolderActionMessage(`${count}件の単語を削除しました。`);
  }

  function toggleWordReviewFilter(filter: WordReviewFilter) {
    setWordReviewFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
    setSelectedFolderWordKeys(new Set());
  }

  function startWordReviewSession(cards: SavedWordEntry[]) {
    const reviewCards = cards.filter((entry) => !entry.isArchived);
    if (!reviewCards.length) {
      setFolderActionMessage("復習する単語がありません。");
      return;
    }

    setWordReviewSession({
      cards: reviewCards,
      index: 0,
      revealed: false,
      results: [],
      completed: false,
    });
    setFolderWordEditing(false);
    setSelectedFolderWordKeys(new Set());
    setFolderActionMessage(null);
    resetWordSearchState();
  }

  function reviewSelectedFolderWords() {
    if (!openWordFolder || !selectedFolderWordKeys.size) {
      setFolderActionMessage("復習する単語を選択してください。");
      return;
    }

    startWordReviewSession(
      openWordFolder.words.filter((entry) => selectedFolderWordKeys.has(wordEntryKey(entry))),
    );
  }

  function updateReviewedWordStatus(
    targetWord: string,
    status: Exclude<WordReviewStatus, "unreviewed">,
  ) {
    const targetKey = normalizeSavedWord(targetWord);
    const reviewedAt = new Date().toISOString();
    setWordFolders((current) =>
      current.map((folder) => ({
        ...folder,
        words: folder.words.map((entry) =>
          normalizeSavedWord(entry.word) === targetKey
            ? {
                ...entry,
                status,
                lastReviewedAt: reviewedAt,
                reviewCount: (entry.reviewCount ?? 0) + 1,
              }
            : entry,
        ),
      })),
    );
  }

  function answerWordReview(status: Exclude<WordReviewStatus, "unreviewed">) {
    if (!wordReviewSession) {
      return;
    }

    const currentCard = wordReviewSession.cards[wordReviewSession.index];
    if (!currentCard) {
      return;
    }

    updateReviewedWordStatus(currentCard.word, status);
    const results = [
      ...wordReviewSession.results,
      { word: currentCard.word, status },
    ];
    const nextIndex = wordReviewSession.index + 1;
    setWordReviewSession({
      ...wordReviewSession,
      index: nextIndex,
      revealed: false,
      results,
      completed: nextIndex >= wordReviewSession.cards.length,
    });
  }

  function restartBadWordReview() {
    if (!wordReviewSession) {
      return;
    }

    const badWords = new Set(
      wordReviewSession.results
        .filter((result) => result.status === "bad")
        .map((result) => normalizeSavedWord(result.word)),
    );
    startWordReviewSession(
      wordReviewSession.cards.filter((entry) => badWords.has(normalizeSavedWord(entry.word))),
    );
  }

  async function openReviewedWordDetails(entry: SavedWordEntry) {
    setSearchLevel(entry.level);
    setSearchPurpose(entry.purpose);
    setSearchTerm(entry.word);
    setWordMemo(entry.note ?? "");
    setWordMemoMessage(null);
    setWordReviewSession(null);
    await loadWord(entry.word);
  }

  function errorCodeForSubmission(item: SubmissionWithFeedback) {
    return `TANUKI-${item.id.slice(0, 8).toUpperCase()}`;
  }

  async function copyErrorCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setErrorCodeCopied(true);
    } catch {
      setErrorCodeCopied(false);
    }
  }

  function hideFailedSubmission(id: string) {
    setHiddenFailedSubmissionIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setErrorDetailSubmission(null);
    setErrorCodeCopied(false);
  }

  function createWordFolder() {
    const name = newFolderName.trim();
    const normalizedName = name.toLocaleLowerCase("ja-JP");
    if (!name) {
      setFolderActionMessage("フォルダ名を入力してください。");
      return;
    }
    if (
      wordFolders.some(
        (folder) => folder.name.trim().toLocaleLowerCase("ja-JP") === normalizedName,
      )
    ) {
      setFolderActionMessage("同じ名前のフォルダがあります。");
      return;
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `folder-${Date.now()}`;
    const folder: WordFolder = { id, name, words: [] };
    setWordFolders((current) => [...current, folder]);
    setSelectedWordFolderId(id);
    setNewFolderName("");
    setCreateFolderOpen(false);
    setFolderActionMessage("フォルダを作成しました。");
  }

  async function openSavedWord(entry: SavedWordEntry) {
    setSearchLevel(entry.level);
    setSearchPurpose(entry.purpose);
    setSearchTerm(entry.word);
    setWordMemo(entry.note ?? "");
    setWordMemoMessage(null);
    setOpenWordFolderId(null);
    await loadWord(entry.word);
  }

  async function authHeaders(): Promise<Record<string, string>> {
    const session = (await supabase?.auth.getSession())?.data.session;
    return session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : {};
  }

  async function loadHistory() {
    if (!authUser) {
      return;
    }

    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ scope: "mine" });
      if (billing?.isAdmin && adminTestMode) {
        params.set("includeTest", "true");
      }
      const response = await fetch(`/api/submissions?${params.toString()}`, {
        headers: await authHeaders(),
      });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        submissions: SubmissionWithFeedback[];
      };
      setHistory(data.submissions);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadBilling() {
    if (!authUser) {
      return;
    }

    const response = await fetch("/api/billing/status", {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { billing: BillingState };
    setBilling(data.billing);
  }

  async function syncCheckoutIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "success" || !sessionId) {
      return;
    }

    const response = await fetch("/api/billing/sync-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ sessionId }),
    });

    if (response.ok) {
      await loadBilling();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  async function fetchSubmissionById(id: string) {
    const response = await fetch(`/api/submissions?id=${id}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { submission: SubmissionWithFeedback };
    return data.submission;
  }

  function upsertHistoryItem(nextSubmission: SubmissionWithFeedback) {
    setHistory((current) => [
      nextSubmission,
      ...current.filter((item) => item.id !== nextSubmission.id),
    ]);
  }

  async function pollSubmissionInBackground(id: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      const latest = await fetchSubmissionById(id);
      if (!latest) {
        continue;
      }

      upsertHistoryItem(latest);
      if (latest.status === "completed" || latest.status === "failed") {
        await loadHistory();
        await loadBilling();
        await loadListeningStates();
        setSubmissionNotice(
          latest.status === "completed"
            ? "添削が完了しました。添削履歴から確認できます。"
            : "添削に失敗しました。添削履歴から詳細を確認してください。",
        );
        return;
      }
    }
  }

  function openTutorSubmitDialog() {
    setError(null);
    setCheckoutError(null);

    if (!recordedBlob) {
      setError("先に録音してください。");
      return;
    }

    if (recorderMode !== "practice") {
      setError("シャドーイング添削用に録音してください。");
      return;
    }

    if (!authUser) {
      setError("添削を利用するにはログインしてください。");
      return;
    }

    if (!canSubmitToday) {
      setError(billing?.denialReason ?? "3日間無料体験を開始してください。");
      return;
    }

    setTutorSubmitOpen(true);
  }

  async function submitRecording(tutorId: TutorId) {
    try {
      setError(null);
      setCheckoutError(null);
      setTutorSubmitOpen(false);
      setSelectedTutorId(tutorId);
      const audioBlob = recordedBlob;

      if (!audioBlob) {
        setError("先に録音してください。");
        return;
      }

      if (!authUser) {
        setError("添削を利用するにはログインしてください。");
        return;
      }

      if (!canSubmitToday) {
        setError(billing?.denialReason ?? "3日間無料体験を開始してください。");
        return;
      }

      const sourceSnapshot = selectedMaterial;
      const duration = Math.max(1, Math.round(elapsed || 32));
      setSubmissionNotice("お疲れ様でした。添削が完了したら通知をします。");
      setActiveTab("speak");
      setSpeakView("home");
      setArticlePracticeOpen(false);
      resetRecording();
      void submitRecordingInBackground({
        audioBlob,
        duration,
        source: sourceSnapshot,
        tutorId,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "処理に失敗しました。");
    }
  }

  async function submitRecordingInBackground(input: {
    audioBlob: Blob;
    duration: number;
    source: PracticeSource;
    tutorId: TutorId;
  }) {
    try {
      const formData = new FormData();
      formData.append("sourceType", input.source.sourceType);
      formData.append("sourceId", input.source.sourceId);
      if (input.source.sourceType === "material") {
        formData.append("materialId", input.source.sourceId);
      }
      formData.append("tutorId", input.tutorId);
      formData.append("duration", String(input.duration));
      if (billing?.isAdmin && adminTestMode) {
        formData.append("isTest", "true");
        formData.append("testLabel", "admin-test");
      }
      formData.append(
        "audio",
        new File([input.audioBlob], "shadowing.wav", { type: input.audioBlob.type }),
      );

      const uploadResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });
      const uploadData = (await uploadResponse.json()) as {
        submission?: SubmissionWithFeedback;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadData.submission) {
        throw new Error(uploadData.error ?? "アップロードに失敗しました。");
      }

      upsertHistoryItem(uploadData.submission);
      const id = uploadData.submission.id;
      const processResponse = await fetch("/api/assessment/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ submissionId: id, tutorId: input.tutorId, background: true }),
      });
      const processData = (await processResponse.json()) as {
        submission?: SubmissionWithFeedback;
        error?: string;
      };

      if (!processResponse.ok || !processData.submission) {
        throw new Error(processData.error ?? "添削処理に失敗しました。");
      }

      upsertHistoryItem(processData.submission);
      await loadHistory();
      void pollSubmissionInBackground(id);
    } catch (caught) {
      setSubmissionNotice(null);
      setError(caught instanceof Error ? caught.message : "処理に失敗しました。");
    }
  }

  async function startCheckout() {
    setCheckoutError(null);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({}),
    });
    const data = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      setCheckoutError(data.error ?? "Checkoutを開始できませんでした。");
      return;
    }

    window.location.href = data.url;
  }

  async function openBillingPortal() {
    setCheckoutError(null);
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: await authHeaders(),
    });
    const data = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      setCheckoutError(data.error ?? "サブスク管理画面を開けませんでした。");
      return;
    }

    window.location.href = data.url;
  }

  async function sendAuthLink() {
    if (authSubmitting || authCooldownSeconds > 0) {
      return;
    }

    if (!supabase) {
      setAuthMessage("Supabaseの公開環境変数が未設定のため、現在はデモユーザーで動作します。");
      return;
    }

    if (!email.trim()) {
      setAuthMessage("メールアドレスを入力してください。");
      return;
    }

    setAuthSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectUrl(),
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        const mappedError = authErrorMessage(signInError.message);
        setAuthMessage(mappedError.text);
        setAuthCooldownSeconds(mappedError.cooldownSeconds);
        return;
      }

      setAuthMessage("登録/ログイン用リンクをメールで送信しました。受信ボックスを確認し、メール内のリンクを開くとTanukiに戻ります。");
      setAuthCooldownSeconds(30);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setAuthUser(null);
    setAuthMessage(null);
    setSubmission(null);
    setHistory([]);
    setBilling(null);
    setSubmissionNotice(null);
    setSettingsOpen(false);
  }

  function formatJapaneseMonthDay(value: string) {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  }

  const currentStatus = submission?.status;
  const isProcessing =
    currentStatus === "uploaded" ||
    currentStatus === "azure_processing" ||
    currentStatus === "llm_processing";
  const selectedLevelMaterials = useMemo(
    () => materials.filter((material) => material.wpmRange === selectedWpmRange),
    [selectedWpmRange],
  );
  const productionHistory = useMemo(
    () => history.filter((item) => !item.isTest),
    [history],
  );
  const testHistory = useMemo(
    () => history.filter((item) => item.isTest),
    [history],
  );
  const activeHistory = billing?.isAdmin && adminTestMode ? testHistory : productionHistory;
  const completedSourceKeys = useMemo(
    () =>
      new Set(
        activeHistory
          .filter((item) => item.status === "completed" && item.feedback)
          .map((item) => `${item.sourceType}:${item.sourceId}`),
      ),
    [activeHistory],
  );
  const practicedListeningArticleIds = useMemo(
    () =>
      new Set(
        [
          ...productionHistory
            .filter(
              (item) =>
                item.status === "completed" &&
                item.feedback &&
                item.sourceType === "listening_article",
            )
            .map((item) => item.sourceId),
          ...listeningArticleStates
            .filter((state) => state.shadowingCompletedAt)
            .map((state) => state.articleId),
        ],
      ),
    [productionHistory, listeningArticleStates],
  );
  const visibleListeningArticles = useMemo(
    () => {
      const filtered = listeningArticles.filter((article) => {
        const matchesType = article.contentType === "listening";
        const matchesCategory =
          listeningCategory === "ALL" || article.category === listeningCategory;
        return matchesType && matchesCategory;
      });

      return [...filtered].sort((a, b) => {
        if (listeningFavoritesFirst) {
          const favoriteDiff =
            Number(likedListeningArticles.has(b.id)) -
            Number(likedListeningArticles.has(a.id));
          if (favoriteDiff !== 0) {
            return favoriteDiff;
          }
        }

        return b.date.localeCompare(a.date);
      });
    },
    [
      likedListeningArticles,
      listeningArticles,
      listeningCategory,
      listeningFavoritesFirst,
    ],
  );
  const visibleShadowingArticles = useMemo(
    () => {
      const filtered = listeningArticles.filter((article) => {
        const matchesType = article.contentType === "shadowing";
        const matchesCategory =
          shadowingCategory === "ALL" || article.category === shadowingCategory;
        return matchesType && matchesCategory;
      });

      return [...filtered]
        .sort((a, b) => {
          if (shadowingFavoritesFirst) {
            const favoriteDiff =
              Number(likedListeningArticles.has(b.id)) -
              Number(likedListeningArticles.has(a.id));
            if (favoriteDiff !== 0) {
              return favoriteDiff;
            }
          }

          const aWpm = a.wpm ?? 0;
          const bWpm = b.wpm ?? 0;
          return listeningWpmSort === "asc" ? aWpm - bWpm : bWpm - aWpm;
        });
    },
    [
      likedListeningArticles,
      listeningArticles,
      listeningWpmSort,
      shadowingCategory,
      shadowingFavoritesFirst,
    ],
  );
  const selectedListeningArticle = selectedListeningArticleId
    ? listeningArticles.find((article) => article.id === selectedListeningArticleId) ?? null
    : null;
  const selectedSearchLevel = searchLevelOptions.find((option) => option.id === searchLevel);
  const selectedSearchPurpose = searchPurposeOptions.find(
    (option) => option.id === searchPurpose,
  );
  const selectedWordExample = wordResult?.examples[searchLevel]?.[searchPurpose];
  const selectedWordFolder =
    wordFolders.find((folder) => folder.id === selectedWordFolderId) ?? wordFolders[0];
  const openWordFolder = openWordFolderId
    ? wordFolders.find((folder) => folder.id === openWordFolderId) ?? null
    : null;
  const isWordSaved = wordResult
    ? wordFolders.some((folder) =>
        folder.words.some(
          (entry) => normalizeSavedWord(entry.word) === normalizeSavedWord(wordResult.word),
        ),
      )
    : false;
  const weakWordCandidates = useMemo(() => {
    const seen = new Set<string>();
    return (submission?.feedback?.problemWords ?? [])
      .filter((item) => {
        const key = normalizeSavedWord(item.word);
        if (!key || key.length <= 1 || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [submission?.feedback?.problemWords]);
  const visibleHistory = useMemo(
    () =>
      activeHistory.filter(
        (item) => item.status !== "failed" || !hiddenFailedSubmissionIds.has(item.id),
      ),
    [activeHistory, hiddenFailedSubmissionIds],
  );
  const completedHistory = useMemo(
    () => productionHistory.filter((item) => item.status === "completed" && item.feedback),
    [productionHistory],
  );
  const completedWpmValues = useMemo(
    () =>
      completedHistory
        .map((item) => getPracticeSourceFromSubmission(item)?.wpm)
        .filter((value): value is number => typeof value === "number"),
    [completedHistory],
  );
  const monthlyWpmAverages = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const item of completedHistory) {
      const wpm = getPracticeSourceFromSubmission(item)?.wpm;
      const month = monthKeyFromDate(item.createdAt);
      if (typeof wpm !== "number" || !month) {
        continue;
      }
      byMonth.set(month, [...(byMonth.get(month) ?? []), wpm]);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        label: compactMonthLabel(month),
        average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        count: values.length,
      }));
  }, [completedHistory]);
  const monthlyWpmChart = useMemo(() => {
    const width = 300;
    const height = 96;
    const paddingX = 20;
    const paddingY = 18;
    const values = monthlyWpmAverages.map((item) => item.average);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const range = Math.max(1, max - min);
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;
    const points = monthlyWpmAverages.map((item, index) => {
      const x =
        monthlyWpmAverages.length === 1
          ? width / 2
          : paddingX + (usableWidth * index) / (monthlyWpmAverages.length - 1);
      const y = paddingY + ((max - item.average) / range) * usableHeight;
      return { ...item, x, y };
    });

    return {
      width,
      height,
      min,
      max,
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(" "),
    };
  }, [monthlyWpmAverages]);
  const progressSummary = {
    total: completedHistory.length,
    averageWpm: completedWpmValues.length
      ? Math.round(
          completedWpmValues.reduce((sum, value) => sum + value, 0) / completedWpmValues.length,
        )
      : null,
    weekCount: completedHistory.filter(
      (item) => Date.now() - Date.parse(item.createdAt) < 7 * 24 * 60 * 60 * 1000,
    ).length,
  };
  const recentHistory = visibleHistory.slice(0, 3);
  const streak = calculateStreak(loginDays);
  const calendarDays = buildCalendarDays(calendarMonth);
  const markedLoginDays = new Set(loginDays);
  const actualCanSubmitToday =
    billing?.isAdmin && adminTestMode ? true : billing ? billing.canSubmit : true;
  const canSubmitToday =
    billing?.isAdmin && adminCompletionPreview === "completed"
      ? false
      : billing?.isAdmin && adminCompletionPreview === "open"
        ? true
        : actualCanSubmitToday;
  const homeBillingMessage = billing?.trialEndsAt
    ? `3日間無料体験中: ${formatJapaneseMonthDay(billing.trialEndsAt)}から有料プランに移行`
    : billing?.isSubscriber
      ? `有料プラン: 今日の残り ${billing.dailySubmissionsRemaining}/${billing.dailySubmissionLimit}`
      : billing?.freeSubmissionsRemaining
        ? "無料添削が1回使えます"
        : "無料添削を利用済みです";
  const effectiveListeningAccent: ListeningAccent = canUseListeningPremiumFeature()
    ? listeningAccent
    : "us";
  const usesStandaloneListHeader =
    activeTab === "listening" || (activeTab === "speak" && speakView === "home");
  const selectedListeningAudioUrl = selectedListeningArticle
    ? audioUrlForListeningArticle(selectedListeningArticle, effectiveListeningAccent)
    : null;
  const openFolderActiveWords = openWordFolder?.words.filter((entry) => !entry.isArchived) ?? [];
  const openFolderReviewCounts = wordReviewStatusOptions.reduce(
    (acc, option) => ({
      ...acc,
      [option.id]: openFolderActiveWords.filter(
        (entry) => getWordReviewStatus(entry) === option.id,
      ).length,
    }),
    {} as Record<WordReviewStatus, number>,
  );
  const openFolderVisibleWords = openFolderActiveWords.filter(
    (entry) =>
      !wordReviewFilters.size || wordReviewFilters.has(getWordReviewStatus(entry)),
  );
  const currentReviewCard =
    wordReviewSession && !wordReviewSession.completed
      ? wordReviewSession.cards[wordReviewSession.index] ?? null
      : null;
  const currentReviewKey = currentReviewCard ? normalizeSavedWord(currentReviewCard.word) : "";
  const currentReviewWord =
    currentReviewKey && currentReviewKey in wordReviewDetails
      ? wordReviewDetails[currentReviewKey]
      : undefined;
  const reviewSummary = wordReviewSession
    ? {
        good: wordReviewSession.results.filter((result) => result.status === "good").length,
        fair: wordReviewSession.results.filter((result) => result.status === "fair").length,
        bad: wordReviewSession.results.filter((result) => result.status === "bad").length,
      }
    : { good: 0, fair: 0, bad: 0 };

  function handleCalendarTouchEnd(endX: number) {
    if (touchStartX === null) {
      return;
    }

    const delta = endX - touchStartX;
    if (Math.abs(delta) > 42) {
      setCalendarMonth((current) => addMonths(current, delta < 0 ? 1 : -1));
    }
    setTouchStartX(null);
  }

  return (
    <main className="min-h-screen bg-[#11140f] text-stone-100">
      <div className="app-shell">
        {usesStandaloneListHeader ? null : (
        <header className={activeTab === "home" ? "topbar" : "topbar is-actions-only"}>
          {activeTab === "home" ? (
            <div>
              <p className="eyebrow">AI shadowing assessment</p>
              <h1>tanuki</h1>
            </div>
          ) : null}
          <div className="topbar-actions">
            {authUser ? (
              <div className="settings-menu">
                <button
                  aria-expanded={settingsOpen}
                  aria-label="設定"
                  className="settings-button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  type="button"
                >
                  <Settings size={18} />
                </button>
                {settingsOpen ? (
                  <div className="settings-popover">
                    <button
                      onClick={() => {
                        setPreferencesOpen(true);
                        setSettingsOpen(false);
                      }}
                      type="button"
                    >
                      <SlidersHorizontal size={16} />
                      学習設定
                    </button>
                    <button onClick={openBillingPortal} type="button">
                      <CreditCard size={16} />
                      サブスクリプションの管理
                    </button>
                    <button onClick={signOut} type="button">
                      <LogOut size={16} />
                      サインアウト
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="auth-box">
                  <input
                    aria-label="メールアドレス"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    type="email"
                    value={email}
                  />
                  <button
                    disabled={authSubmitting || authCooldownSeconds > 0}
                    onClick={sendAuthLink}
                    type="button"
                  >
                    {authSubmitting ? "送信中" : "登録 / ログイン"}
                  </button>
                </div>
                {authCooldownSeconds > 0 ? (
                  <p className="auth-resend-timer">再送信まで{authCooldownSeconds}秒</p>
                ) : null}
                {authMessage ? (
                  <div className="auth-helper" role="status" aria-live="polite">
                    <strong>メールを確認してください</strong>
                    <span>{authMessage}</span>
                    <small>届かない場合は、迷惑メールフォルダも確認してください。</small>
                  </div>
                ) : null}
                <button className="checkout-button" onClick={startCheckout} type="button">
                  <CreditCard size={18} />
                  3日間無料体験
                </button>
              </>
            )}
          </div>
        </header>
        )}

        {checkoutError ? <div className="notice">{checkoutError}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
        {submissionNotice ? (
          <div className="submission-notice" role="status" aria-live="polite">
            <CheckCircle2 size={20} />
            <span>{submissionNotice}</span>
          </div>
        ) : null}
        {tutorSubmitOpen ? (
          <div className="tutor-submit-backdrop" role="presentation">
            <section className="tutor-submit-modal" aria-label="提出するチューターを選ぶ">
              <div className="tutor-submit-heading">
                <div>
                  <span>choose tutor</span>
                  <h2>誰に添削してもらいますか？</h2>
                  <p>選んだチューターが今回の録音をチェックします。</p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setTutorSubmitOpen(false)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="tutor-submit-options">
                {tutorProfiles.map((tutor) => (
                  <button
                    className="tutor-submit-card"
                    key={tutor.id}
                    onClick={() => void submitRecording(tutor.id)}
                    type="button"
                  >
                    <TutorAvatar type={tutor.avatarType} />
                    <span>
                      <strong>{tutor.displayName}</strong>
                      <small>{tutor.roleLabel}</small>
                      <em>{tutor.shortDescription}</em>
                    </span>
                    <Send size={18} />
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}
        {preferencesOpen ? (
          <section className="preferences-panel" aria-label="学習設定">
            <div className="preferences-header">
              <div>
                <p className="eyebrow">Search preferences</p>
                <h2>学習設定</h2>
              </div>
              <button
                className="ghost-button"
                onClick={() => setPreferencesOpen(false)}
                type="button"
              >
                閉じる
              </button>
            </div>

            <div className="preference-group">
              <div className="preference-title">
                <BookOpen size={18} />
                <span>レベル</span>
              </div>
              <div className="preference-options">
                {searchLevelOptions.map((option) => (
                  <button
                    className={searchLevel === option.id ? "is-active" : ""}
                    key={option.id}
                    onClick={() => setSearchLevel(option.id)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <div className="preference-title">
                <BriefcaseBusiness size={18} />
                <span>用途</span>
              </div>
              <div className="preference-options">
                {searchPurposeOptions.map((option) => (
                  <button
                    className={searchPurpose === option.id ? "is-active" : ""}
                    key={option.id}
                    onClick={() => setSearchPurpose(option.id)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        {authUser && billing && activeTab === "home" ? (
          <div className="billing-strip">
            <span>{homeBillingMessage}</span>
          </div>
        ) : null}

        {activeTab === "home" ? (
          <section className="home-screen">
            <div className="home-hero">
              <p className="eyebrow">Learning streak</p>
              <h2>{streak}日連続学習中</h2>
              <span>{authUser ? "今日のログインを記録しました" : "ログインすると学習日が記録されます"}</span>
            </div>

            <div
              className="calendar-panel"
              onTouchEnd={(event) => handleCalendarTouchEnd(event.changedTouches[0].clientX)}
              onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
            >
              <div className="calendar-header">
                <button
                  aria-label="前の月"
                  onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <strong>{monthLabel(calendarMonth)}</strong>
                <button
                  aria-label="次の月"
                  onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="calendar-weekdays">
                {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day, index) => {
                  const currentDate = day
                    ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                    : null;
                  const isMarked = currentDate
                    ? markedLoginDays.has(dateKey(currentDate))
                    : false;
                  return (
                    <div
                      className={isMarked ? "is-marked" : ""}
                      key={`${calendarMonth.getMonth()}-${index}`}
                    >
                      {day ? <span>{day}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <section className="speak-card speak-progress-card">
              <div className="panel-heading">
                <span>進捗</span>
              </div>
              <div className="progress-summary-grid is-two-column">
                <div>
                  <span>総添削回数</span>
                  <strong>{progressSummary.total}回</strong>
                </div>
                <div>
                  <span>今週の練習</span>
                  <strong>{progressSummary.weekCount}回</strong>
                </div>
              </div>
              <div className="monthly-wpm-card" aria-label="月別の平均WPM">
                <div className="monthly-wpm-header">
                  <div>
                    <span>練習した記事の平均WPM</span>
                    <strong>
                      {progressSummary.averageWpm ? `${progressSummary.averageWpm} WPM` : "-"}
                    </strong>
                  </div>
                  <small>月別平均</small>
                </div>
                {monthlyWpmChart.points.length ? (
                  <div className="monthly-wpm-chart">
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox={`0 0 ${monthlyWpmChart.width} ${monthlyWpmChart.height}`}
                    >
                      <line
                        className="monthly-wpm-axis"
                        x1="20"
                        x2="280"
                        y1="78"
                        y2="78"
                      />
                      {monthlyWpmChart.points.length > 1 ? (
                        <polyline className="monthly-wpm-line" points={monthlyWpmChart.line} />
                      ) : null}
                      {monthlyWpmChart.points.map((point) => (
                        <g key={point.month}>
                          <circle className="monthly-wpm-dot" cx={point.x} cy={point.y} r="4" />
                          <text className="monthly-wpm-value" x={point.x} y={point.y - 9}>
                            {point.average}
                          </text>
                          <text className="monthly-wpm-label" x={point.x} y="92">
                            {point.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <p className="monthly-wpm-empty">練習データが増えると月別平均を表示します。</p>
                )}
              </div>
            </section>

            <section className="speak-card">
              <div className="panel-heading">
                <span>添削履歴</span>
              </div>
              {!authUser ? (
                <div className="history-empty">
                  ログインすると、直近の添削履歴をここに表示します。
                </div>
              ) : historyLoading ? (
                <div className="history-empty">読み込み中...</div>
              ) : recentHistory.length ? (
                <div className="history-list">
                  {recentHistory.map((item) => {
                    const source = getPracticeSourceFromSubmission(item);
                    const failed = item.status === "failed";
                    return (
                      <button
                        className={failed ? "history-row is-error" : "history-row"}
                        disabled={!item.feedback && !failed}
                        key={item.id}
                        onClick={() => {
                          if (failed) {
                            setErrorDetailSubmission(item);
                            setErrorCodeCopied(false);
                            return;
                          }
                          openSubmissionFromHistory(item, source, "home");
                        }}
                        type="button"
                      >
                        <Clock3 size={16} />
                        <span>
                          <strong>{source?.title ?? item.sourceId}</strong>
                          {item.isTest ? <small>管理者テスト</small> : null}
                          <small>
                            {new Intl.DateTimeFormat("ja-JP", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.createdAt))}
                          </small>
                          {item.feedback ? (
                            <em>総合スコア {overallScore(item.feedback)}</em>
                          ) : (
                            <small>{statusLabels[item.status]}</small>
                          )}
                        </span>
                        <strong className="history-repeat-label">
                          {failed
                            ? "エラーの詳細を確認する"
                            : item.feedback
                              ? "添削結果を見る"
                              : statusLabels[item.status]}
                        </strong>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="history-empty">
                  まだ提出履歴はありません。録音を提出するとここに追加されます。
                </div>
              )}
              <button
                className="text-link-button"
                disabled={!authUser}
                onClick={() => {
                  setActiveTab("speak");
                  setSpeakView("history");
                }}
                type="button"
              >
                過去の添削履歴を確認する
                <ChevronRight size={16} />
              </button>
            </section>
          </section>
        ) : null}

        {activeTab === "speak" ? (
          <section className="speak-screen">
            {speakView === "home" ? (
              <>
                {billing?.isAdmin ? (
                  <section className="admin-test-panel" aria-label="管理者テスト">
                    <div>
                      <span>Admin test</span>
                      <strong>{adminTestMode ? "テストモード" : "通常モード"}</strong>
                      <p>
                        通常モードでは本番の見え方だけを表示します。テストモードの提出は進捗や本日の添削回数に含まれません。
                      </p>
                    </div>
                    <div className="admin-test-controls">
                      <button
                        className={!adminTestMode ? "is-active" : ""}
                        onClick={() => {
                          setAdminTestMode(false);
                          setAdminCompletionPreview("actual");
                        }}
                        type="button"
                      >
                        通常モード
                      </button>
                      <button
                        className={adminTestMode ? "is-active" : ""}
                        onClick={() => setAdminTestMode(true)}
                        type="button"
                      >
                        テストモード
                      </button>
                    </div>
                    <div className="admin-preview-controls">
                      <span>本日の表示</span>
                      {[
                        ["actual", "実データ"],
                        ["open", "未完了表示"],
                        ["completed", "完了済み表示"],
                      ].map(([value, label]) => (
                        <button
                          className={adminCompletionPreview === value ? "is-active" : ""}
                          key={value}
                          onClick={() =>
                            setAdminCompletionPreview(value as AdminCompletionPreview)
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section className="listening-screen shadowing-list-screen">
                  <div className="listening-list-header">
                    <div className="listening-list-title-row">
                      <h2>Shadowing</h2>
                      <div className="listening-list-actions">
                        <button
                          aria-label={
                            shadowingFavoritesFirst
                              ? "お気に入り優先をオフ"
                              : "お気に入り優先をオン"
                          }
                          aria-pressed={shadowingFavoritesFirst}
                          className={
                            shadowingFavoritesFirst
                              ? "listening-header-icon is-active"
                              : "listening-header-icon"
                          }
                          onClick={() => setShadowingFavoritesFirst((value) => !value)}
                          type="button"
                        >
                          <Heart size={22} />
                        </button>
                        <button
                          aria-label="学習設定を開く"
                          className="listening-header-icon"
                          onClick={() => setPreferencesOpen(true)}
                          type="button"
                        >
                          <Settings size={22} />
                        </button>
                      </div>
                    </div>
                    <div className="listening-tabs">
                      {listeningCategories.map((category) => (
                        <button
                          className={shadowingCategory === category ? "is-active" : ""}
                          key={category}
                          onClick={() => setShadowingCategory(category)}
                          type="button"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="listening-article-list is-compact">
                    {visibleShadowingArticles.map((article) => {
                      const liked = likedListeningArticles.has(article.id);
                      const practiced = practicedListeningArticleIds.has(article.id);
                      return (
                        <article
                          className="listening-article-card"
                          key={article.id}
                          onClick={() => startShadowingArticle(article)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              startShadowingArticle(article);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="listening-article-body">
                            <div className="listening-meta">
                              <span>{article.category}</span>
                              <span>{article.levelLabel}</span>
                              {article.wpm ? <span>WPM {article.wpm}</span> : null}
                              <span>{article.readTimeMinutes}分</span>
                              <time>{article.date}</time>
                            </div>
                            <h3>{article.title}</h3>
                            <p>{article.description}</p>
                            {practiced ? (
                              <div className="listening-card-stats">
                                <small className="is-practiced">練習済み</small>
                              </div>
                            ) : null}
                          </div>
                          <div className="listening-row-media">
                            <div className="listening-thumbnail" aria-hidden="true">
                              <Mic size={26} />
                            </div>
                            <button
                              aria-label={liked ? "お気に入りを解除" : "お気に入りに追加"}
                              className={liked ? "listen-like is-active" : "listen-like"}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleListeningLike(article.id);
                              }}
                              type="button"
                            >
                              <Heart size={18} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : null}

            {speakView === "level" ? (
              <section className="speak-card">
                <button className="back-button" onClick={() => setSpeakView("home")} type="button">
                  <ArrowLeft size={17} />
                  教材を探す
                </button>
                <div className="speak-page-heading">
                  <p className="eyebrow">{selectedWpmRange}</p>
                  <h2>
                    {wpmLevels.find((level) => level.range === selectedWpmRange)?.description}
                  </h2>
                </div>
                <div className="article-list">
                  {selectedLevelMaterials.map((material) => {
                    const completed = completedSourceKeys.has(`material:${material.id}`);
                    return (
                      <button
                        className={completed ? "article-row is-completed" : "article-row"}
                        key={material.id}
                        onClick={() => {
                          selectPracticeSource("material", material.id);
                          resetRecording();
                          setArticleBackView("level");
                          setArticlePracticeOpen(true);
                          setSpeakView("article");
                        }}
                        type="button"
                      >
                        <BookOpen size={18} />
                        <span>
                          <strong>{material.title}</strong>
                          <small>
                            {material.category} / {material.duration}秒 / {material.accent}
                          </small>
                        </span>
                        {completed ? (
                          <em className="article-completed-badge">
                            <CheckCircle2 size={15} />
                            添削済み
                          </em>
                        ) : null}
                        <ChevronRight size={18} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {speakView === "article" ? (
              <section className="article-practice-layout">
                {submission?.feedback ? (
                  <aside className="result-panel result-panel-complete">
                    <div className="panel-heading">
                      <span>添削結果</span>
                    </div>

                    <div className="feedback-stack">
                      <OverallScoreCard
                        accuracyScore={submission.feedback.accuracyScore}
                        completenessScore={submission.feedback.completenessScore}
                        detailsOpen={scoreDetailsOpen}
                        fluencyScore={submission.feedback.fluencyScore}
                        onToggleDetails={() => setScoreDetailsOpen((value) => !value)}
                        score={overallScore(submission.feedback)}
                      />

                      {submission.feedback.improvementPoints.length ? (
                        <section className="improvement-box">
                          <h3>
                            <CheckCircle2 size={18} />
                            前回からの改善
                          </h3>
                          <div className="improvement-list">
                            {submission.feedback.improvementPoints.map((point) => (
                              <div key={`${point.word}-${point.currentScore}`}>
                                <span>{point.message}</span>
                                <strong>{point.word}</strong>
                                <small>
                                  前回の指摘: {point.previousReason} / 今回 {point.currentScore}点
                                </small>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <FeedbackPointSection
                        points={submission.feedback.goodPoints}
                        title="Good Point"
                        tone="good"
                      />

                      <FeedbackPointSection
                        points={submission.feedback.developmentPoints}
                        title="気になったところ"
                        tone="focus"
                      />

                      <section className="comment-box">
                        <h3>コーチコメント</h3>
                        <p>{submission.feedback.aiComment}</p>
                      </section>

                      {submission.feedback.nextFocus ? (
                        <section className="next-focus-box">
                          <h3>次回のフォーカス</h3>
                          <p>{submission.feedback.nextFocus}</p>
                        </section>
                      ) : null}

                      {weakWordCandidates.length ? (
                        <section className="weak-word-box">
                          <div className="weak-word-heading">
                            <div>
                              <h3>苦手な単語</h3>
                              <p>
                                保存しておくと、単語ページの例文を使ってシャドーイング練習ができます。
                              </p>
                            </div>
                            <label>
                              <input
                                checked={selectedWeakWords.size === weakWordCandidates.length}
                                onChange={(event) =>
                                  setSelectedWeakWords(
                                    event.target.checked
                                      ? new Set(
                                          weakWordCandidates.map((item) =>
                                            normalizeSavedWord(item.word),
                                          ),
                                        )
                                      : new Set(),
                                  )
                                }
                                type="checkbox"
                              />
                              まとめて選択
                            </label>
                          </div>

                          <div className="weak-word-list">
                            {weakWordCandidates.map((item) => {
                              const key = normalizeSavedWord(item.word);
                              return (
                                <label key={`${key}-${item.reason}`}>
                                  <input
                                    checked={selectedWeakWords.has(key)}
                                    onChange={(event) =>
                                      setSelectedWeakWords((current) => {
                                        const next = new Set(current);
                                        if (event.target.checked) {
                                          next.add(key);
                                        } else {
                                          next.delete(key);
                                        }
                                        return next;
                                      })
                                    }
                                    type="checkbox"
                                  />
                                  <span>
                                    <strong>{item.word}</strong>
                                    <small>{item.reason}</small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="weak-word-actions">
                            <label className="weak-word-folder-field">
                              <span>保存先フォルダ</span>
                              <select
                                aria-label="苦手な単語の保存先フォルダ"
                                onChange={(event) => {
                                  if (event.target.value === "__create_folder__") {
                                    setCreateFolderOpen(true);
                                    return;
                                  }
                                  setSelectedWordFolderId(event.target.value);
                                }}
                                value={selectedWordFolder?.id}
                              >
                                {wordFolders.map((folder) => (
                                  <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </option>
                                ))}
                                <option value="__create_folder__">+ フォルダを新規作成</option>
                              </select>
                            </label>
                            <button
                              className="is-primary"
                              onClick={() =>
                                saveWeakWordsToFolder(
                                  selectedWordFolder?.id ?? wordFolders[0]?.id ?? "review",
                                  weakWordCandidates,
                                )
                              }
                              type="button"
                            >
                              選択した単語を保存
                            </button>
                          </div>
                          {weakWordSaveMessage ? (
                            <p className="weak-word-message">{weakWordSaveMessage}</p>
                          ) : null}
                        </section>
                      ) : null}

                      {canSubmitToday ? (
                        <button className="reshadow-button" onClick={showRepeatPractice} type="button">
                          <RotateCcw size={18} />
                          同じ教材をシャドーイングする
                        </button>
                      ) : (
                        <div className="reshadow-button is-completed" aria-live="polite">
                          本日の添削は完了しています
                        </div>
                      )}
                    </div>
                  </aside>
                ) : null}

                {articlePracticeOpen || !submission?.feedback ? (
                  <section className="practice-panel" id="article-practice-panel">
                  <div className="lesson-header">
                    <div>
                      <p className="eyebrow">
                        {selectedMaterial.wpmRange} / {selectedMaterial.category}
                      </p>
                      <h2>{selectedMaterial.title}</h2>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => playMaterial(selectedMaterial)}
                      title="教材音声を再生"
                      type="button"
                    >
                      <Play size={18} />
                    </button>
                  </div>

                  <div className="script-box">
                    <Waves size={18} />
                    <ScriptWithHighlights
                      problemWords={submission?.feedback?.problemWords ?? []}
                      text={selectedMaterial.scriptText}
                    />
                  </div>

                  <div className="focus-grid">
                    {selectedMaterial.focus.map((item) => (
                      <div key={item}>
                        <span>focus</span>
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="recorder-strip">
                    <div>
                      <span>録音時間</span>
                      <strong>{formatTime(elapsed)}</strong>
                    </div>
                    <div className="record-actions">
                      {recorderState !== "recording" ? (
                        <button
                          className="primary-button"
                          onClick={() => startRecording("practice")}
                          type="button"
                        >
                          <Mic size={18} />
                          録音
                        </button>
                      ) : (
                        <button className="danger-button" onClick={stopRecording} type="button">
                          <Square size={18} />
                          停止
                        </button>
                      )}
                      <button
                        className="ghost-button"
                        disabled={!recordedBlob && recorderState !== "recorded"}
                        onClick={() =>
                          resetRecording({ clearSubmission: !submission?.feedback })
                        }
                        type="button"
                      >
                        <RotateCcw size={17} />
                        やり直し
                      </button>
                    </div>
                  </div>

                  {recordedUrl && recorderMode === "practice" ? (
                    <audio className="recorded-audio" controls src={recordedUrl}>
                      <track kind="captions" />
                    </audio>
                  ) : null}

                  <div className="submit-row">
                    <button
                      className="submit-button"
                      disabled={isProcessing}
                      onClick={openTutorSubmitDialog}
                      type="button"
                    >
                      {isProcessing ? <Pause size={18} /> : <Send size={18} />}
                      添削に出す
                    </button>
                  </div>

                </section>
                ) : null}

              </section>
            ) : null}

            {speakView === "history" ? (
              <section className="speak-card">
                <button className="back-button" onClick={() => setSpeakView("home")} type="button">
                  <ArrowLeft size={17} />
                  Speak
                </button>
                <div className="speak-page-heading">
                  <p className="eyebrow">Correction history</p>
                  <h2>過去の添削履歴</h2>
                </div>
                {!authUser ? (
                  <div className="history-empty">
                    ログインすると、過去の添削結果をここから見返せます。
                  </div>
                ) : historyLoading ? (
                  <div className="history-empty">読み込み中...</div>
                ) : visibleHistory.length ? (
                  <div className="history-list">
                    {visibleHistory.map((item) => {
                      const source = getPracticeSourceFromSubmission(item);
                      const failed = item.status === "failed";
                      return (
                        <button
                          className={failed ? "history-row is-error" : "history-row"}
                          disabled={!item.feedback && !failed}
                          key={item.id}
                          onClick={() => {
                            if (failed) {
                              setErrorDetailSubmission(item);
                              setErrorCodeCopied(false);
                              return;
                            }
                            openSubmissionFromHistory(item, source, "history");
                          }}
                          type="button"
                        >
                          <Clock3 size={16} />
                          <span>
                            <strong>{source?.title ?? item.sourceId}</strong>
                            <small>
                              {new Intl.DateTimeFormat("ja-JP", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(item.createdAt))}
                            </small>
                            {item.feedback ? (
                              <em>
                                総合スコア {overallScore(item.feedback)}
                              </em>
                            ) : (
                              <small>{statusLabels[item.status]}</small>
                            )}
                          </span>
                          <strong className="history-repeat-label">
                            {failed
                              ? "エラーの詳細を確認する"
                              : item.feedback
                                ? "添削結果を見る"
                                : statusLabels[item.status]}
                          </strong>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="history-empty">
                    まだ提出履歴はありません。録音を提出するとここに追加されます。
                  </div>
                )}
              </section>
            ) : null}
          </section>
        ) : null}

        {activeTab === "listening" ? (
          selectedListeningArticle ? (
            <section className="listening-detail-screen">
              <div className="listening-detail-nav">
                <button
                  aria-label="記事一覧へ戻る"
                  onClick={() => {
                    setSelectedListeningArticleId(null);
                    setSelectedListeningWord(null);
                    setActiveListeningSentenceId(null);
                    setListeningPlaybackProgress(0);
                    setActiveTab(listeningDetailBackTab);
                    stopListeningArticle();
                  }}
                  type="button"
                >
                  <ArrowLeft size={24} />
                </button>
                <strong>
                  {selectedListeningArticle.contentType === "shadowing"
                    ? "Shadowing"
                    : "Listening"}
                </strong>
                <button
                  aria-label={
                    likedListeningArticles.has(selectedListeningArticle.id)
                      ? "お気に入りを解除"
                      : "お気に入りに追加"
                  }
                  className={
                    likedListeningArticles.has(selectedListeningArticle.id)
                      ? "listen-like is-active"
                      : "listen-like"
                  }
                  onClick={() => toggleListeningLike(selectedListeningArticle.id)}
                  type="button"
                >
                  <Heart size={28} />
                </button>
              </div>

              <header className="listening-detail-hero">
                <div className="listening-detail-meta">
                  <span>
                    {selectedListeningArticle.contentType === "shadowing"
                      ? "シャドーイング"
                      : "リスニング"}
                  </span>
                  <span>{selectedListeningArticle.category}</span>
                  <span>{selectedListeningArticle.levelLabel}</span>
                  <span>{selectedListeningArticle.readTimeMinutes}分</span>
                </div>
                <h2>{selectedListeningArticle.title}</h2>
                <p>{selectedListeningArticle.description}</p>
                <div className="listening-stats">
                  {selectedListeningArticle.contentType === "shadowing" && selectedListeningArticle.wpm ? (
                    <span>WPM {selectedListeningArticle.wpm}</span>
                  ) : null}
                  <time>{selectedListeningArticle.date}</time>
                </div>
              </header>

              <section className="listening-control-panel" aria-label="再生と保存">
                <div className="listening-player">
                  <button
                    onClick={() => playListeningArticle(selectedListeningArticle)}
                    type="button"
                  >
                    <Play size={22} />
                    再生
                  </button>
                  <button onClick={stopListeningArticle} type="button">
                    <Pause size={22} />
                    停止
                  </button>
                  {selectedListeningArticle.contentType === "listening" && selectedListeningAudioUrl ? (
                    <audio
                      key={`${selectedListeningArticle.id}-${effectiveListeningAccent}`}
                      ref={listeningAudioRef}
                      onEnded={() => {
                        setActiveListeningSentenceId(null);
                        setListeningPlaybackProgress(0);
                      }}
                      onTimeUpdate={() => updateListeningAudioProgress(selectedListeningArticle)}
                      preload="metadata"
                      src={selectedListeningAudioUrl}
                    >
                      <track kind="captions" />
                    </audio>
                  ) : null}
                </div>

                <div className="listening-premium-tools" aria-label="リスニング拡張機能">
                  <div className="listening-speed-control">
                    <div>
                      <span>再生速度</span>
                      <strong>{formatPlaybackRate(listeningPlaybackRate)}</strong>
                    </div>
                    <div className="listening-speed-buttons" aria-label="再生速度を調整">
                      <button
                        aria-label="再生速度を下げる"
                        onClick={() => changeListeningPlaybackRate(-1)}
                        type="button"
                      >
                        -
                      </button>
                      <button
                        aria-label="再生速度を上げる"
                        onClick={() => changeListeningPlaybackRate(1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="listening-save-cta"
                    onClick={openListeningSaveNotice}
                    type="button"
                  >
                    <BookmarkPlus size={20} />
                    保存する
                  </button>
                </div>
              </section>

              {selectedListeningArticle.contentType === "listening" ? (
                <section className="listening-accent-toggle" aria-label="英語音声の種類">
                  <div>
                    {listeningAccentOptions.map((option) => (
                      <button
                        className={effectiveListeningAccent === option.id ? "is-active" : ""}
                        key={option.id}
                        onClick={() => selectListeningAccent(option.id)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="listening-view-toggle" aria-label="本文表示切替">
                {[
                  { id: "both", label: "英日" },
                  { id: "english", label: "英語" },
                  { id: "japanese", label: "日本語" },
                ].map((mode) => (
                  <button
                    className={listeningTextMode === mode.id ? "is-active" : ""}
                    key={mode.id}
                    onClick={() => setListeningTextMode(mode.id as ListeningTextMode)}
                    type="button"
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <article className="listening-reader">
                {selectedListeningArticle.paragraphs.map((paragraph, index) => (
                  <section className="listening-reader-block" key={`${paragraph.en}-${index}`}>
                    {listeningTextMode !== "japanese" ? (
                      selectedListeningArticle.contentType === "listening" ? (
                        <div className="listening-sentence-list">
                          {getParagraphListeningSentences(
                            selectedListeningArticle,
                            paragraph,
                            index,
                          ).map((sentence) => (
                            <div
                              className={
                                activeListeningSentenceId === sentence.id ? "is-active" : ""
                              }
                              key={sentence.id}
                              onClick={() => playListeningSentence(selectedListeningArticle, sentence)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  playListeningSentence(selectedListeningArticle, sentence);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <ListeningParagraph
                                onWordClick={(word) => setSelectedListeningWord(word)}
                                text={sentence.en}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ListeningParagraph
                          onWordClick={(word) => setSelectedListeningWord(word)}
                          text={paragraph.en}
                        />
                      )
                    ) : null}
                    {listeningTextMode !== "english" ? (
                      selectedListeningArticle.contentType === "listening" ? (
                        <div className="listening-sentence-translation-list">
                          {getParagraphListeningSentences(
                            selectedListeningArticle,
                            paragraph,
                            index,
                          ).map((sentence) => (
                            <p
                              className={
                                activeListeningSentenceId === sentence.id
                                  ? "listening-japanese-text is-active"
                                  : "listening-japanese-text"
                              }
                              key={`${sentence.id}-ja`}
                            >
                              {sentence.ja}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="listening-japanese-text">{paragraph.ja}</p>
                      )
                    ) : null}
                  </section>
                ))}
              </article>

              {selectedListeningArticle.contentType === "shadowing" ? (
                <button
                  className="article-shadowing-button"
                  onClick={() => startShadowingArticle(selectedListeningArticle)}
                  type="button"
                >
                  <Mic size={20} />
                  この記事でシャドーイング
                </button>
              ) : null}

              {selectedListeningArticle.contentType === "listening" ? (
                <section className="listening-self-recording">
                  <div className="listening-self-recording-copy">
                    <span>Self recording</span>
                    <strong>録音して聞く</strong>
                    <p>
                      リスニング教材のため添削は行われません。自分の音声を聞き返す練習用です。
                    </p>
                  </div>
                  <div className="listening-self-recording-controls">
                    <div className="listening-self-recording-time">
                      <span>録音時間</span>
                      <strong>{formatTime(recorderMode === "listening" ? elapsed : 0)}</strong>
                    </div>
                    <div className="listening-self-recording-actions">
                      {recorderState === "recording" && recorderMode === "listening" ? (
                        <button
                          className="danger-button"
                          onClick={stopRecording}
                          type="button"
                        >
                          <Square size={18} />
                          停止
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={() => startRecording("listening")}
                          type="button"
                        >
                          <Mic size={18} />
                          録音して聞く
                        </button>
                      )}
                      <button
                        className="ghost-button"
                        disabled={recorderMode !== "listening" || recorderState === "idle"}
                        onClick={() => resetRecording()}
                        type="button"
                      >
                        <RotateCcw size={17} />
                        やり直し
                      </button>
                    </div>
                  </div>
                  {recordedUrl && recorderMode === "listening" ? (
                    <audio className="listening-recorded-audio" controls src={recordedUrl}>
                      <track kind="captions" />
                    </audio>
                  ) : null}
                </section>
              ) : null}

              <button
                className={
                  completedListeningArticles.has(selectedListeningArticle.id)
                    ? "listening-complete-button is-completed"
                    : "listening-complete-button"
                }
                onClick={() =>
                  setCompletedListeningArticles((current) => {
                    const next = new Set(current);
                    next.add(selectedListeningArticle.id);
                    void saveListeningState({
                      articleId: selectedListeningArticle.id,
                      readCompleted: true,
                    });
                    return next;
                  })
                }
                type="button"
              >
                {completedListeningArticles.has(selectedListeningArticle.id)
                  ? "完了済み"
                  : "この記事を完了"}
              </button>
            </section>
          ) : (
            <section className="listening-screen">
              <div className="listening-list-header">
                <div className="listening-list-title-row">
                  <h2>Listening</h2>
                  <div className="listening-list-actions">
                    <button
                      aria-label={
                        listeningFavoritesFirst
                          ? "お気に入り優先をオフ"
                          : "お気に入り優先をオン"
                      }
                      aria-pressed={listeningFavoritesFirst}
                      className={
                        listeningFavoritesFirst
                          ? "listening-header-icon is-active"
                          : "listening-header-icon"
                      }
                      onClick={() => setListeningFavoritesFirst((value) => !value)}
                      type="button"
                    >
                      <Heart size={22} />
                    </button>
                    <button
                      aria-label="学習設定を開く"
                      className="listening-header-icon"
                      onClick={() => setPreferencesOpen(true)}
                      type="button"
                    >
                      <Settings size={22} />
                    </button>
                  </div>
                </div>
                <div className="listening-tabs">
                  {listeningCategories.map((category) => (
                    <button
                      className={listeningCategory === category ? "is-active" : ""}
                      key={category}
                      onClick={() => setListeningCategory(category)}
                      type="button"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="listening-article-list">
                {visibleListeningArticles.map((article) => {
                  const liked = likedListeningArticles.has(article.id);
                  const read = completedListeningArticles.has(article.id);
                  return (
                    <article
                      className="listening-article-card"
                      key={article.id}
                      onClick={() => {
                        setListeningDetailBackTab("listening");
                        setSelectedListeningArticleId(article.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setListeningDetailBackTab("listening");
                          setSelectedListeningArticleId(article.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="listening-article-body">
                        <div className="listening-meta">
                          <span>{article.category}</span>
                          <span>{article.levelLabel}</span>
                          <span>{article.readTimeMinutes}分</span>
                          <time>{article.date}</time>
                        </div>
                        <h3>{article.title}</h3>
                        <p>{article.description}</p>
                        {read ? (
                          <div className="listening-card-stats">
                            <small className="is-read">読了</small>
                          </div>
                        ) : null}
                      </div>
                      <div className="listening-row-media">
                        <div className="listening-thumbnail" aria-hidden="true">
                          <BookOpen size={30} />
                        </div>
                        <button
                          aria-label={liked ? "お気に入りを解除" : "お気に入りに追加"}
                          className={liked ? "listen-like is-active" : "listen-like"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleListeningLike(article.id);
                          }}
                          type="button"
                        >
                          <Heart size={18} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )
        ) : null}

        {selectedListeningWord ? (
          <div className="listening-word-popover" role="dialog" aria-label="単語アクション">
            <div>
              <strong>{selectedListeningWord}</strong>
            </div>
            <button
              onClick={() => {
                const word = selectedListeningWord;
                setSelectedListeningWord(null);
                resetWordSearchState();
                setSearchTerm(word);
                setActiveTab("search");
                void loadWord(word);
              }}
              type="button"
            >
              <Search size={18} />
              検索
            </button>
            <button
              aria-label="閉じる"
              onClick={() => setSelectedListeningWord(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        ) : null}

        {errorDetailSubmission ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact error-detail-modal" aria-label="エラー詳細">
              <div className="word-modal-heading">
                <div>
                  <span>assessment error</span>
                  <h2>エラーの詳細</h2>
                  <p>
                    添削回数が消費された場合は、設定＞お問い合わせページよりエラーコードをお送りください。
                  </p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => {
                    setErrorDetailSubmission(null);
                    setErrorCodeCopied(false);
                  }}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="error-code-panel">
                <span>エラーコード</span>
                <strong>{errorCodeForSubmission(errorDetailSubmission)}</strong>
                <button
                  onClick={() =>
                    void copyErrorCode(errorCodeForSubmission(errorDetailSubmission))
                  }
                  type="button"
                >
                  <Copy size={17} />
                  {errorCodeCopied ? "コピーしました" : "エラーコードをコピー"}
                </button>
              </div>

              <div className="hide-error-history">
                <p>この履歴を非表示にする</p>
                <div>
                  <button
                    onClick={() => {
                      setErrorDetailSubmission(null);
                      setErrorCodeCopied(false);
                    }}
                    type="button"
                  >
                    いいえ
                  </button>
                  <button
                    className="is-danger"
                    onClick={() => hideFailedSubmission(errorDetailSubmission.id)}
                    type="button"
                  >
                    はい
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {listeningFeatureNotice ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact listening-feature-modal" aria-label="リスニング機能">
              <div className="word-modal-heading">
                <div>
                  <span>
                    {listeningFeatureNotice === "savePaid" ? "coming soon" : "premium"}
                  </span>
                  <h2>
                    {listeningFeatureNotice === "speed"
                      ? "再生速度の調整は有料機能です"
                      : listeningFeatureNotice === "accent"
                        ? "音声の切り替えは有料機能です"
                      : listeningFeatureNotice === "saveFree"
                        ? "保存機能は有料ユーザー限定です"
                        : "保存機能はアプリ版で提供予定です"}
                  </h2>
                  <p>
                    {listeningFeatureNotice === "speed"
                      ? "0.7xから1.5xまで、0.1刻みで聞き取りやすい速度に調整できます。"
                      : listeningFeatureNotice === "accent"
                        ? "有料ユーザーはアメリカ英語とイギリス英語の音声を切り替えて学習できます。"
                      : listeningFeatureNotice === "saveFree"
                        ? "アプリ版では記事と音声を保存して、オフラインでも学習できる予定です。"
                        : "現在はWeb版のため、オンラインでご利用ください。"}
                  </p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setListeningFeatureNotice(null)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="listening-feature-modal-actions">
                {listeningFeatureNotice === "savePaid" ? (
                  <button
                    className="ghost-button"
                    onClick={() => setListeningFeatureNotice(null)}
                    type="button"
                  >
                    閉じる
                  </button>
                ) : (
                  <>
                    <button
                      className="ghost-button"
                      onClick={() => setListeningFeatureNotice(null)}
                      type="button"
                    >
                      あとで
                    </button>
                    <button className="checkout-button" onClick={startCheckout} type="button">
                      <CreditCard size={18} />
                      3日間無料体験
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "search" ? (
          wordReviewSession ? (
            <section className="word-review-screen">
              <div className="word-result-nav">
                <button
                  aria-label="単語一覧へ戻る"
                  onClick={() => setWordReviewSession(null)}
                  type="button"
                >
                  <ArrowLeft size={28} />
                </button>
                <strong>単語復習</strong>
                <span />
              </div>

              {wordReviewSession.completed ? (
                <section className="word-review-summary">
                  <span>review completed</span>
                  <h2>復習おつかれさまでした</h2>
                  <div className="word-review-summary-grid">
                    <div>
                      <strong>○</strong>
                      <span>覚えた</span>
                      <b>{reviewSummary.good}語</b>
                    </div>
                    <div>
                      <strong>△</strong>
                      <span>うろ覚え</span>
                      <b>{reviewSummary.fair}語</b>
                    </div>
                    <div>
                      <strong>×</strong>
                      <span>忘れた</span>
                      <b>{reviewSummary.bad}語</b>
                    </div>
                  </div>
                  <div className="word-review-summary-actions">
                    {reviewSummary.bad > 0 ? (
                      <button onClick={restartBadWordReview} type="button">
                        ×の単語をもう一度復習する
                      </button>
                    ) : null}
                    <button onClick={() => setWordReviewSession(null)} type="button">
                      一覧に戻る
                    </button>
                  </div>
                </section>
              ) : currentReviewCard ? (
                <section
                  className={wordReviewSession.revealed ? "word-review-card is-revealed" : "word-review-card"}
                >
                  <button
                    className="word-review-card-main"
                    onClick={() =>
                      setWordReviewSession((current) =>
                        current ? { ...current, revealed: true } : current,
                      )
                    }
                    type="button"
                  >
                    <span>
                      {wordReviewSession.index + 1} / {wordReviewSession.cards.length}
                    </span>
                    <h2>{currentReviewCard.word}</h2>
                    {wordReviewSession.revealed ? (
                      currentReviewWord === undefined ? (
                        <p>意味を確認しています...</p>
                      ) : currentReviewWord ? (
                        <>
                          <small>{formatIpa(currentReviewWord.stress)}</small>
                          <p>
                            {currentReviewWord.definitions[0]?.definition_jp ??
                              "意味はまだ準備中です"}
                          </p>
                        </>
                      ) : (
                        <p>この単語はまだ意味が登録されていません</p>
                      )
                    ) : (
                      <p>タップして意味を確認</p>
                    )}
                  </button>

                  {wordReviewSession.revealed ? (
                    <div className="word-review-back-actions">
                      {currentReviewWord ? (
                        <button onClick={() => openReviewedWordDetails(currentReviewCard)} type="button">
                          詳細を確認する
                          <ChevronRight size={18} />
                        </button>
                      ) : (
                        <button disabled type="button">
                          詳細はまだ表示できません
                        </button>
                      )}
                      <div className="word-review-answer-grid">
                        <button onClick={() => answerWordReview("bad")} type="button">
                          × 忘れた
                        </button>
                        <button onClick={() => answerWordReview("fair")} type="button">
                          △ うろ覚え
                        </button>
                        <button onClick={() => answerWordReview("good")} type="button">
                          ○ 覚えた
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </section>
          ) : wordResult ? (
            <section className="word-result-page">
              <div className="word-result-nav">
                <button
                  aria-label="検索へ戻る"
                  onClick={resetWordSearchState}
                  type="button"
                >
                  <ArrowLeft size={28} />
                </button>
                <strong>{wordResult.word}</strong>
                <button aria-label="共有" type="button">
                  <Share2 size={24} />
                </button>
              </div>

              <div className="word-hero">
                <div>
                  <h2>{wordResult.word}</h2>
                  {wordLookup ? (
                    <div className="word-lookup-note">
                      {wordLookup.input} は {wordLookup.label}です
                    </div>
                  ) : null}
                  <p>{formatIpa(wordResult.stress)}</p>
                  <span>{wordResult.phonetic_jp}</span>
                </div>
                <button
                  aria-label={`${wordResult.word}を再生`}
                  onClick={() => speakEnglish(wordResult.word)}
                  type="button"
                >
                  <Volume2 size={34} />
                </button>
              </div>

              <div className="definition-stack">
                {wordResult.definitions.map((definition, index) => (
                  <section className="definition-card" key={`${definition.part_of_speech}-${index}`}>
                    <div>
                      <span>{index + 1}</span>
                      <strong>{definition.part_of_speech}</strong>
                    </div>
                    <p>{definition.definition_en}</p>
                    <p>{definition.definition_jp}</p>
                  </section>
                ))}
              </div>

              {selectedWordExample ? (
                <section className="word-section">
                  <h3>例文</h3>
                  <div className="example-card">
                    <span>
                      {selectedSearchLevel?.label} / {selectedSearchPurpose?.label}
                    </span>
                    <p>
                      <HighlightedSentence
                        sentence={selectedWordExample.sentence_en}
                        word={wordResult.word}
                      />
                    </p>
                    <small>{selectedWordExample.sentence_jp}</small>
                    <div className="example-actions">
                      <button
                        aria-label="例文を再生"
                        onClick={() => speakEnglish(selectedWordExample.sentence_en)}
                        type="button"
                      >
                        <Play size={22} />
                      </button>
                      <button aria-label="一時停止" onClick={() => window.speechSynthesis.cancel()} type="button">
                        <Pause size={22} />
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {wordResult.usage_notes ? (
                <section className="word-section">
                  <h3>用法</h3>
                  <p className="usage-note">{wordResult.usage_notes}</p>
                </section>
              ) : null}

              {wordResult.synonyms.length ? (
                <section className="word-section">
                  <h3>類義語</h3>
                  <div className="synonym-list">
                    {wordResult.synonyms.map((synonym) => (
                      <button
                        key={synonym}
                        onClick={() => {
                          resetWordSearchState();
                          setSearchTerm(synonym);
                          void loadWord(synonym);
                        }}
                        type="button"
                      >
                        {synonym}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="word-section word-memo-section">
                <h3>単語メモ</h3>
                <textarea
                  onChange={(event) => {
                    setWordMemo(event.target.value);
                    setWordMemoMessage(null);
                  }}
                  placeholder="発音で気をつけること、例文で覚えたいポイントなどをメモ"
                  value={wordMemo}
                />
              </section>

              <div className={isWordSaved ? "word-save-actions is-saved" : "word-save-actions"}>
                <button
                  className={isWordSaved ? "save-word-button is-saved" : "save-word-button"}
                  onClick={() =>
                    isWordSaved ? updateCurrentSavedWordMemo() : setSaveWordModalOpen(true)
                  }
                  type="button"
                >
                  <BookmarkPlus size={24} />
                  {isWordSaved ? "メモを更新" : "単語を保存"}
                </button>
                {isWordSaved ? (
                  <button
                    className="remove-saved-word-button"
                    onClick={() => setRemoveWordModalOpen(true)}
                    type="button"
                  >
                  保存を解除
                  </button>
                ) : null}
              </div>
              {wordMemoMessage ? <p className="word-memo-message">{wordMemoMessage}</p> : null}
            </section>
          ) : wordLookupCandidates.length ? (
            <section className="word-result-page word-candidate-page">
              <div className="word-result-nav">
                <button
                  aria-label="検索へ戻る"
                  onClick={resetWordSearchState}
                  type="button"
                >
                  <ArrowLeft size={28} />
                </button>
                <strong>{wordLookupCandidates[0]?.input}</strong>
                <span />
              </div>
              <div className="word-candidate-copy">
                <span>候補が複数あります</span>
                <h2>どの意味で調べますか？</h2>
                <p>近い意味を選ぶと、対応する単語ページを表示します。</p>
              </div>
              <div className="word-candidate-list">
                {wordLookupCandidates.map((candidate) => (
                  <button
                    key={`${candidate.headword}-${candidate.relation}`}
                    onClick={() => {
                      setSearchTerm(candidate.input);
                      void loadWord(candidate.input, candidate);
                    }}
                    type="button"
                  >
                    <strong>{candidate.label}</strong>
                    <span>{candidate.definitionPreview || "意味を表示します"}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : openWordFolder ? (
            <section className="search-screen">
              <div className="folder-detail-nav">
	                <button
	                  aria-label="フォルダ一覧へ戻る"
	                  onClick={() => {
	                    setOpenWordFolderId(null);
	                    setFolderWordEditing(false);
	                    setSelectedFolderWordKeys(new Set());
	                  }}
	                  type="button"
	                >
	                  <ArrowLeft size={24} />
	                </button>
	                <div>
	                  <span>word folder</span>
	                  <strong>
	                    {openWordFolder.name}
	                    <small>{openWordFolder.words.length}件</small>
	                  </strong>
	                </div>
	                <button
	                  className="folder-detail-edit-button"
	                  onClick={() => openFolderEditModal(openWordFolder)}
	                  type="button"
	                >
	                  編集
	                </button>
	              </div>

              {openWordFolder.words.length ? (
                <div className="folder-word-list is-page">
	                  <div className="folder-word-list-heading">
	                    <div>
	                      <h3>保存した単語</h3>
	                      <span>{openFolderVisibleWords.length}件表示中</span>
	                    </div>
	                    <div className="folder-word-heading-actions">
	                      <button
	                        disabled={!openFolderVisibleWords.length}
	                        onClick={() => startWordReviewSession(openFolderVisibleWords)}
	                        type="button"
	                      >
	                        表示中の単語を復習
	                      </button>
	                      <button
	                        onClick={() => {
	                          setFolderWordEditing((value) => !value);
	                          setSelectedFolderWordKeys(new Set());
	                        }}
	                        type="button"
	                      >
	                        {folderWordEditing ? "完了" : "選択して復習"}
	                      </button>
	                    </div>
	                  </div>
	                  <div className="word-review-filter-row" aria-label="定着度フィルター">
	                    <button
	                      className={!wordReviewFilters.size ? "is-active" : ""}
	                      onClick={() => {
	                        setWordReviewFilters(new Set());
	                        setSelectedFolderWordKeys(new Set());
	                      }}
	                      type="button"
	                    >
	                      すべて {openFolderActiveWords.length}語
	                    </button>
	                    {wordReviewStatusOptions.map((option) => (
	                      <button
	                        className={wordReviewFilters.has(option.id) ? "is-active" : ""}
	                        key={option.id}
	                        onClick={() => toggleWordReviewFilter(option.id)}
	                        type="button"
	                      >
	                        {option.mark} {option.label} {openFolderReviewCounts[option.id]}語
	                      </button>
	                    ))}
	                  </div>
	                  <div className="folder-word-items">
	                    {openFolderVisibleWords.map((entry) => {
	                      const status = wordReviewStatusOptions.find(
	                        (option) => option.id === getWordReviewStatus(entry),
	                      );
	                      return (
	                      <button
	                        className={
	                          selectedFolderWordKeys.has(wordEntryKey(entry))
	                            ? "is-selected"
	                            : ""
	                        }
	                        key={`${entry.word}-${entry.level}-${entry.purpose}-${entry.savedAt}`}
	                        onClick={() =>
	                          folderWordEditing
	                            ? toggleFolderWordSelection(entry)
	                            : openSavedWord(entry)
	                        }
	                        type="button"
	                      >
	                        <strong>{entry.word}</strong>
	                        <span className={`word-review-status-badge is-${getWordReviewStatus(entry)}`}>
	                          {status?.mark} {status?.label}
	                        </span>
	                        {entry.note ? <small>{entry.note}</small> : null}
	                      </button>
	                    );
	                    })}
	                  </div>
	                  {!openFolderVisibleWords.length ? (
	                    <p className="folder-empty-text">この条件に合う単語はありません。</p>
	                  ) : null}
	                  {folderWordEditing ? (
	                    <div className="folder-bulk-actions">
	                      <span>{selectedFolderWordKeys.size}件選択中</span>
	                      <select
	                        aria-label="移動先フォルダ"
	                        onChange={(event) => setBulkMoveFolderId(event.target.value)}
	                        value={
	                          bulkMoveFolderId ||
	                          wordFolders.find((folder) => folder.id !== openWordFolder.id)?.id ||
	                          ""
	                        }
	                      >
	                        {wordFolders
	                          .filter((folder) => folder.id !== openWordFolder.id)
	                          .map((folder) => (
	                            <option key={folder.id} value={folder.id}>
	                              {folder.name}
	                            </option>
	                          ))}
	                      </select>
	                      <button
	                        disabled={!selectedFolderWordKeys.size}
	                        onClick={reviewSelectedFolderWords}
	                        type="button"
	                      >
	                        復習する
	                      </button>
	                      <button
	                        disabled={!selectedFolderWordKeys.size}
	                        onClick={moveSelectedFolderWords}
	                        type="button"
	                      >
	                        移動
	                      </button>
	                      <button
	                        className="is-danger"
	                        disabled={!selectedFolderWordKeys.size}
	                        onClick={deleteSelectedFolderWords}
	                        type="button"
	                      >
	                        削除
	                      </button>
	                    </div>
	                  ) : null}
	                  {folderActionMessage ? (
	                    <p className="folder-action-message">{folderActionMessage}</p>
	                  ) : null}
	                </div>
              ) : (
                <div className="folder-empty-panel">
                  <Folder size={36} />
                  <h2>まだ単語がありません</h2>
                  <p>検索結果ページで「単語を保存」を押すと、このフォルダに追加できます。</p>
                </div>
              )}
            </section>
          ) : (
            <section className="search-screen">
              <section className="word-search-section">
                <div className="panel-heading">
                  <span>検索</span>
                </div>
                <form className="word-search" onSubmit={searchWord}>
                  <Search size={20} />
                  <input
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="単語を検索"
                    type="search"
                    value={searchTerm}
                  />
                  <button disabled={wordSearchLoading} type="submit">
                    {wordSearchLoading ? "検索中" : "検索"}
                  </button>
                </form>
                {wordSearchError ? <div className="notice error">{wordSearchError}</div> : null}
              </section>

              {missingWordQuery ? (
                <section className="missing-word-card">
                  <div className="missing-word-art" aria-hidden="true">
                    <span className="missing-word-ear left" />
                    <span className="missing-word-ear right" />
                    <span className="missing-word-face">
                      <span />
                      <span />
                      <i />
                    </span>
                  </div>
                  <div className="missing-word-copy">
                    <span>word request</span>
                    <h2>ごめんなさい、検索した単語「{missingWordQuery}」はまだ表示できません</h2>
                    <p>
                      3日以内に表示できるようにしますね。検索してくれた単語をフォルダに保存しておくこともできます。
                    </p>
                  </div>
                  <div className="missing-word-save">
                    <label>
                      <span>保存先フォルダ</span>
                      <select
                        aria-label="未登録単語の保存先フォルダ"
                        onChange={(event) => {
                          if (event.target.value === "__create_folder__") {
                            setCreateFolderOpen(true);
                            return;
                          }
                          setSelectedWordFolderId(event.target.value);
                        }}
                        value={selectedWordFolder?.id}
                      >
                        {wordFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                        <option value="__create_folder__">+ 新規フォルダを作成</option>
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        saveMissingWordToFolder(
                          selectedWordFolder?.id ?? wordFolders[0]?.id ?? "review",
                        )
                      }
                      type="button"
                    >
                      この単語を保存する
                    </button>
                  </div>
                  {missingWordSaveMessage ? (
                    <p className="missing-word-message">{missingWordSaveMessage}</p>
                  ) : null}
                </section>
              ) : null}

	              <section className="word-folder-section">
	                <div className="folder-section-heading">
	                  <div>
	                    <span>folders</span>
	                    <h2>単語フォルダ</h2>
	                  </div>
	                  <div className="folder-section-actions">
	                    <p>保存した単語は、保存時のレベルと用途で表示されます。</p>
	                    <button
	                      onClick={() => {
	                        setFolderGridEditing((value) => !value);
	                        setFolderActionMessage(null);
	                      }}
	                      type="button"
	                    >
	                      {folderGridEditing ? "完了" : "編集"}
	                    </button>
	                  </div>
	                </div>

	                <div className="word-folder-grid">
	                  {wordFolders.map((folder, index) =>
	                    folderGridEditing ? (
	                      <article className="word-folder-card is-editing" key={folder.id}>
	                        <Folder size={26} />
	                        <span>{folder.name}</span>
	                        <strong>{folder.words.length} words</strong>
	                        <div className="folder-card-edit-actions">
	                          <button
	                            aria-label="上へ移動"
	                            disabled={index === 0}
	                            onClick={() => moveWordFolder(folder.id, -1)}
	                            type="button"
	                          >
	                            <ArrowUp size={17} />
	                          </button>
	                          <button
	                            aria-label="下へ移動"
	                            disabled={index === wordFolders.length - 1}
	                            onClick={() => moveWordFolder(folder.id, 1)}
	                            type="button"
	                          >
	                            <ArrowDown size={17} />
	                          </button>
	                          <button
	                            aria-label="削除"
	                            disabled={wordFolders.length <= 1}
	                            onClick={() => setFolderToDelete(folder)}
	                            type="button"
	                          >
	                            <Trash2 size={17} />
	                          </button>
	                        </div>
	                      </article>
	                    ) : (
	                      <button
	                        className="word-folder-card"
	                        key={folder.id}
	                        onClick={() => {
	                          setSelectedWordFolderId(folder.id);
	                          setOpenWordFolderId(folder.id);
	                          setFolderWordEditing(false);
	                          setSelectedFolderWordKeys(new Set());
	                          setFolderActionMessage(null);
	                          setBulkMoveFolderId(
	                            wordFolders.find((item) => item.id !== folder.id)?.id ?? "",
	                          );
	                        }}
	                        type="button"
	                      >
	                        <Folder size={26} />
	                        <span>{folder.name}</span>
	                        <strong>{folder.words.length} words</strong>
	                      </button>
	                    ),
	                  )}
	                  <button
	                    className="word-folder-card is-create"
                    onClick={() => setCreateFolderOpen(true)}
                    type="button"
                  >
                    <Plus size={30} />
                    <span>新規フォルダ</span>
                    <strong>作成</strong>
                  </button>
                </div>
              </section>
            </section>
          )
        ) : null}

        {saveWordModalOpen && wordResult ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal" aria-label="保存先フォルダを選ぶ">
              <div className="word-modal-heading">
                <div>
                  <span>save word</span>
                  <h2>{wordResult.word} を保存</h2>
                  <p>
                    {selectedSearchLevel?.label} / {selectedSearchPurpose?.label} の例文設定で保存します。
                  </p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setSaveWordModalOpen(false)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="modal-folder-list">
                {wordFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => saveWordToFolder(folder.id)}
                    type="button"
                  >
                    <Folder size={24} />
                    <span>{folder.name}</span>
                    <strong>{folder.words.length}</strong>
                  </button>
                ))}
                <button
                  className="modal-create-folder"
                  onClick={() => setCreateFolderOpen(true)}
                  type="button"
                >
                  <Plus size={24} />
                  <span>新規フォルダを作成</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {removeWordModalOpen && wordResult ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact" aria-label="保存済み単語の解除">
              <div className="word-modal-heading">
                <div>
                  <span>remove word</span>
                  <h2>{wordResult.word} の保存を解除</h2>
                  <p>
                    保存済みの同じ単語をフォルダから削除します。レベルや用途が違っていても、
                    同じ単語は1件として扱います。
                  </p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setRemoveWordModalOpen(false)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="remove-word-actions">
                <button onClick={() => setRemoveWordModalOpen(false)} type="button">
                  キャンセル
                </button>
                <button className="is-danger" onClick={removeCurrentSavedWord} type="button">
                  保存を解除
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {folderEditModal ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact" aria-label="フォルダ編集">
              <div className="word-modal-heading">
                <div>
                  <span>edit folder</span>
                  <h2>フォルダを編集</h2>
                  <p>フォルダ名の変更と削除ができます。</p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setFolderEditModal(null)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="folder-create-form">
                <input
                  onChange={(event) => setFolderDraftName(event.target.value)}
                  placeholder="フォルダ名"
                  value={folderDraftName}
                />
                <button onClick={renameWordFolder} type="button">
                  保存
                </button>
              </div>
              <div className="remove-word-actions">
                <button onClick={() => setFolderEditModal(null)} type="button">
                  キャンセル
                </button>
                <button
                  className="is-danger"
                  disabled={wordFolders.length <= 1}
                  onClick={() => {
                    setFolderToDelete(folderEditModal);
                    setFolderEditModal(null);
                  }}
                  type="button"
                >
                  フォルダを削除
                </button>
              </div>
              {folderActionMessage ? (
                <p className="folder-action-message">{folderActionMessage}</p>
              ) : null}
            </section>
          </div>
        ) : null}

        {folderToDelete ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact" aria-label="フォルダ削除確認">
              <div className="word-modal-heading">
                <div>
                  <span>delete folder</span>
                  <h2>{folderToDelete.name} を削除</h2>
                  <p>
                    このフォルダ内の単語 {folderToDelete.words.length}件もすべて削除されます。
                    本当に削除しますか？
                  </p>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => setFolderToDelete(null)}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="remove-word-actions">
                <button onClick={() => setFolderToDelete(null)} type="button">
                  いいえ
                </button>
                <button
                  className="is-danger"
                  onClick={() => deleteWordFolder(folderToDelete.id)}
                  type="button"
                >
                  はい、削除
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {createFolderOpen ? (
          <div className="word-modal-backdrop" role="presentation">
            <section className="word-modal is-compact" aria-label="新規フォルダ作成">
              <div className="word-modal-heading">
                <div>
                  <span>new folder</span>
                  <h2>フォルダを作成</h2>
                </div>
                <button
                  aria-label="閉じる"
                  onClick={() => {
                    setCreateFolderOpen(false);
                    setNewFolderName("");
                    setFolderActionMessage(null);
                  }}
                  type="button"
                >
                  <X size={22} />
                </button>
              </div>
              <form
                className="folder-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  createWordFolder();
                }}
              >
                <input
                  autoFocus
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="フォルダ名"
                  value={newFolderName}
                />
                <button type="submit">作成</button>
              </form>
              {folderActionMessage ? (
                <p className="folder-action-message">{folderActionMessage}</p>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>

      <nav className="mobile-footer" aria-label="主要ナビゲーション">
        {footerTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              aria-label={tab.label}
              className={activeTab === tab.id ? "is-active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              type="button"
            >
              <Icon size={22} />
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function mergePcmChunks(chunks: Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const samples = mergePcmChunks(chunks);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}
