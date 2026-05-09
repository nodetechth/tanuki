import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");

const DEFAULT_INPUT = "templates/listening-articles.batch.template.json";
const DEFAULT_OUTPUT_ROOT = "scripts/content/upsert-output";
const CONTENT_TYPES = new Set(["shadowing", "listening"]);
const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const STATUSES = new Set(["draft", "reviewed", "published"]);
const ACCENTS = ["us", "uk"];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env"));

  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(PROJECT_ROOT, options.input ?? DEFAULT_INPUT);
  const outputRoot = path.resolve(PROJECT_ROOT, options.output ?? DEFAULT_OUTPUT_ROOT);
  const dryRun = options.dryRun !== "false";
  const only = new Set(splitCsv(options.only));
  const strict = options.strict === "true";
  const includeDrafts = options.includeDrafts === "true";
  const batch = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const articles = resolveArticles(batch);
  validateBatch(articles, { strict });
  const selectedArticles = only.size
    ? articles.filter((article) => only.has(article.id))
    : articles;
  const rows = selectedArticles.map((article) => articleToRow(article, { strict }));
  const manifest = buildManifest({
    batch,
    inputPath,
    outputRoot,
    dryRun,
    totalArticles: articles.length,
    selectedArticles,
    rows,
  });

  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2));
    printSummary(manifest);
    return;
  }

  const nonPublished = selectedArticles.filter(
    (article) => normalizeStatus(article.status) !== "published",
  );
  if (nonPublished.length && !includeDrafts) {
    throw new Error(
      [
        "Refusing to upsert draft/reviewed articles.",
        `Non-published ids: ${nonPublished.map((article) => article.id).join(", ")}`,
        "Set article.status to published, or pass --includeDrafts true if this is intentional.",
      ].join(" "),
    );
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("listening_articles")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  manifest.status = "completed";
  manifest.upsertedArticles = rows.length;
  await fs.mkdir(manifest.outputDir, { recursive: true });
  await fs.writeFile(
    path.join(manifest.outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  printSummary(manifest);
}

function resolveArticles(batch) {
  if (Array.isArray(batch)) {
    return batch;
  }
  if (Array.isArray(batch.articles)) {
    return batch.articles;
  }
  throw new Error("Input JSON must be an array or contain an articles array.");
}

function articleToRow(article, options = {}) {
  validateArticle(article, options);

  return {
    id: article.id,
    content_type: article.contentType,
    category: article.category,
    level: article.level,
    level_label: article.levelLabel,
    title: article.title,
    description: article.description,
    body: article.paragraphs,
    key_words: article.keyWords,
    read_time_minutes: readTimeMinutes(article),
    word_count: article.wordCount,
    wpm: article.wpm,
    audio_url: article.audioUrl ?? null,
    audio_sources: article.audioSources ?? {},
    published_at: publishedAt(article),
  };
}

function validateBatch(articles, options = {}) {
  if (!Array.isArray(articles) || !articles.length) {
    throw new Error("Input JSON must contain at least one article.");
  }

  const ids = new Map();
  for (const [index, article] of articles.entries()) {
    if (!article?.id) {
      throw new Error(`articles[${index}] is missing id.`);
    }
    if (ids.has(article.id)) {
      throw new Error(`${article.id}: duplicate article id. First index=${ids.get(article.id)}, duplicate index=${index}.`);
    }
    ids.set(article.id, index);
    validateArticle(article, options);
  }
}

function validateArticle(article, options = {}) {
  const requiredTextFields = [
    "id",
    "contentType",
    "category",
    "level",
    "levelLabel",
    "title",
    "description",
  ];

  for (const field of requiredTextFields) {
    if (!article[field] || typeof article[field] !== "string") {
      throw new Error(`Article is missing required string field: ${field}`);
    }
  }

  if (!CONTENT_TYPES.has(article.contentType)) {
    throw new Error(`${article.id}: contentType must be shadowing or listening.`);
  }
  if (!LEVELS.has(article.level)) {
    throw new Error(`${article.id}: level must be beginner, intermediate, or advanced.`);
  }
  if (!Array.isArray(article.paragraphs) || !article.paragraphs.length) {
    throw new Error(`${article.id}: paragraphs must contain at least one paragraph.`);
  }
  validateStatus(article);
  validateKeyWords(article);
  if (!Number.isFinite(Number(article.wordCount)) || Number(article.wordCount) <= 0) {
    throw new Error(`${article.id}: wordCount must be a positive number.`);
  }
  if (!Number.isFinite(Number(article.wpm)) || Number(article.wpm) <= 0) {
    throw new Error(`${article.id}: wpm must be a positive number.`);
  }
  if (!publishedAt(article)) {
    throw new Error(`${article.id}: publishedAt or date is required.`);
  }
  validateWordCount(article);
  validateWpm(article);

  for (const [index, paragraph] of article.paragraphs.entries()) {
    if (!paragraph?.en || !paragraph?.ja) {
      throw new Error(`${article.id}: paragraphs[${index}] must contain en and ja.`);
    }
  }

  if (article.contentType === "listening") {
    validateListeningArticle(article, {
      requirePublishReady: options.strict || normalizeStatus(article.status) === "published",
    });
  }
}

function validateStatus(article) {
  const status = normalizeStatus(article.status);
  if (!STATUSES.has(status)) {
    throw new Error(`${article.id}: status must be draft, reviewed, or published.`);
  }
}

function normalizeStatus(value) {
  return String(value ?? "draft").trim().toLowerCase();
}

function validateKeyWords(article) {
  if (!Array.isArray(article.keyWords)) {
    throw new Error(`${article.id}: keyWords must be an array.`);
  }
  if (article.keyWords.length < 3 || article.keyWords.length > 6) {
    throw new Error(`${article.id}: keyWords must contain 3-6 words.`);
  }

  const text = normalizeForSearch(article.paragraphs.map((paragraph) => paragraph.en).join(" "));
  const seen = new Set();
  for (const [index, keyword] of article.keyWords.entries()) {
    if (!keyword || typeof keyword !== "string") {
      throw new Error(`${article.id}: keyWords[${index}] must be a non-empty string.`);
    }
    const normalized = normalizeForSearch(keyword);
    if (seen.has(normalized)) {
      throw new Error(`${article.id}: duplicate keyWords entry: ${keyword}`);
    }
    seen.add(normalized);
    if (!keywordAppearsInText(text, normalized)) {
      throw new Error(`${article.id}: keyWords[${index}] does not appear in article text: ${keyword}`);
    }
  }
}

function keywordAppearsInText(normalizedText, normalizedKeyword) {
  return keywordVariants(normalizedKeyword).some((variant) => normalizedText.includes(variant));
}

function keywordVariants(value) {
  const variants = new Set([value]);
  if (value.endsWith("ing") && value.length > 5) variants.add(value.slice(0, -3));
  if (value.endsWith("ed") && value.length > 4) variants.add(value.slice(0, -2));
  if (value.endsWith("s") && value.length > 4) variants.add(value.slice(0, -1));
  return Array.from(variants);
}

function validateWordCount(article) {
  const actual = countEnglishWords(article.paragraphs.map((paragraph) => paragraph.en).join(" "));
  const declared = Number(article.wordCount);
  const tolerance = Math.max(5, Math.ceil(declared * 0.12));
  if (Math.abs(actual - declared) > tolerance) {
    throw new Error(
      `${article.id}: wordCount mismatch. declared=${declared}, actual=${actual}, tolerance=${tolerance}.`,
    );
  }
}

function validateWpm(article) {
  const wpm = Number(article.wpm);
  const min = article.contentType === "shadowing" ? 90 : 100;
  const max = article.contentType === "shadowing" ? 180 : 170;
  if (wpm < min || wpm > max) {
    throw new Error(`${article.id}: wpm ${wpm} is outside expected ${article.contentType} range ${min}-${max}.`);
  }

  const durationSeconds = Number(article.targetDurationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return;
  }

  const calculatedWpm = Number(article.wordCount) / (durationSeconds / 60);
  const tolerance = Math.max(8, calculatedWpm * 0.15);
  if (Math.abs(wpm - calculatedWpm) > tolerance) {
    throw new Error(
      `${article.id}: wpm does not match wordCount/targetDurationSeconds. wpm=${wpm}, calculated=${Math.round(calculatedWpm)}.`,
    );
  }
}

function validateListeningArticle(article, { requirePublishReady }) {
  if (!article.audioSources || typeof article.audioSources !== "object") {
    throw new Error(`${article.id}: listening articles must include audioSources.`);
  }

  for (const accent of ACCENTS) {
    if (!(accent in article.audioSources)) {
      throw new Error(`${article.id}: audioSources.${accent} is required.`);
    }
    if (requirePublishReady && !isHttpUrl(article.audioSources[accent])) {
      throw new Error(`${article.id}: audioSources.${accent} must be a valid URL before publishing.`);
    }
  }

  for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
    if (!Array.isArray(paragraph.sentences) || !paragraph.sentences.length) {
      throw new Error(`${article.id}: listening paragraphs[${paragraphIndex}] must include sentences.`);
    }
    validateListeningSentences(article, paragraph, paragraphIndex, requirePublishReady);
  }
}

function validateListeningSentences(article, paragraph, paragraphIndex, requirePublishReady) {
  for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
    const label = `${article.id}: paragraphs[${paragraphIndex}].sentences[${sentenceIndex}]`;
    for (const field of ["id", "en", "ja"]) {
      if (!sentence[field] || typeof sentence[field] !== "string") {
        throw new Error(`${label}.${field} must be a non-empty string.`);
      }
    }
    if (!paragraph.en.includes(sentence.en)) {
      throw new Error(`${label}.en must appear in the parent paragraph en text.`);
    }
    if (!sentence.timings || typeof sentence.timings !== "object") {
      throw new Error(`${label}.timings is required.`);
    }
    for (const accent of ACCENTS) {
      if (!(accent in sentence.timings)) {
        throw new Error(`${label}.timings.${accent} is required.`);
      }
      if (requirePublishReady) {
        validateTiming(`${label}.timings.${accent}`, sentence.timings[accent]);
      }
    }
  }

  if (requirePublishReady) {
    for (const accent of ACCENTS) {
      validateTimingOrder(article.id, paragraph.sentences, accent);
    }
  }
}

function validateTiming(label, timing) {
  if (!isTimingComplete(timing)) {
    throw new Error(`${label} must contain numeric start and end before publishing.`);
  }
  if (timing.start < 0 || timing.end <= timing.start) {
    throw new Error(`${label} must satisfy 0 <= start < end.`);
  }
}

function validateTimingOrder(articleId, sentences, accent) {
  let previousEnd = -1;
  for (const sentence of sentences) {
    const timing = sentence.timings[accent];
    if (timing.start < previousEnd - 0.05) {
      throw new Error(`${articleId}: sentence timings.${accent} overlap or move backwards near ${sentence.id}.`);
    }
    previousEnd = timing.end;
  }
}

function countEnglishWords(value) {
  return (String(value).match(/[A-Za-z]+(?:['-][A-Za-z]+)?/g) ?? []).length;
}

function normalizeForSearch(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function readTimeMinutes(article) {
  if (Number.isFinite(Number(article.readTimeMinutes)) && Number(article.readTimeMinutes) > 0) {
    return Number(article.readTimeMinutes);
  }
  if (
    Number.isFinite(Number(article.targetDurationSeconds)) &&
    Number(article.targetDurationSeconds) > 0
  ) {
    return Math.max(1, Math.round(Number(article.targetDurationSeconds) / 60));
  }
  return Math.max(1, Math.round(Number(article.wordCount) / Number(article.wpm)));
}

function publishedAt(article) {
  return article.publishedAt ?? normalizeDate(article.date);
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return null;
  return value.replaceAll(".", "-");
}

function buildManifest({ batch, inputPath, outputRoot, dryRun, totalArticles, selectedArticles, rows }) {
  const runId = `${batch.batchId ?? "listening-articles-upsert"}-${timestamp()}`;
  const outputDir = path.join(outputRoot, runId);
  return {
    runId,
    inputPath,
    outputDir,
    generatedAt: new Date().toISOString(),
    dryRun,
    status: dryRun ? "dry-run" : "pending",
    totalArticles,
    selectedArticles: rows.length,
    rows: rows.map((row, index) => summarizeRow(row, selectedArticles[index])),
  };
}

function summarizeRow(row, article) {
  const sentences = countSentences(row.body);
  const timedSentences = countTimedSentences(row.body);

  return {
    id: row.id,
    contentType: row.content_type,
    status: normalizeStatus(article?.status),
    title: row.title,
    publishedAt: row.published_at,
    wordCount: row.word_count,
    wpm: row.wpm,
    readTimeMinutes: row.read_time_minutes,
    audioUrl: Boolean(row.audio_url),
    audioSources: {
      us: Boolean(row.audio_sources?.us),
      uk: Boolean(row.audio_sources?.uk),
    },
    paragraphs: Array.isArray(row.body) ? row.body.length : 0,
    sentences,
    timedSentences,
  };
}

function countSentences(body) {
  if (!Array.isArray(body)) return 0;
  return body.reduce((count, paragraph) => {
    if (!Array.isArray(paragraph.sentences)) return count;
    return count + paragraph.sentences.length;
  }, 0);
}

function countTimedSentences(body) {
  if (!Array.isArray(body)) return 0;
  return body.reduce((count, paragraph) => {
    if (!Array.isArray(paragraph.sentences)) return count;
    return (
      count +
      paragraph.sentences.filter((sentence) => {
        const us = sentence.timings?.us;
        const uk = sentence.timings?.uk;
        return isTimingComplete(us) || isTimingComplete(uk);
      }).length
    );
  }, 0);
}

function isTimingComplete(timing) {
  return (
    typeof timing?.start === "number" &&
    typeof timing?.end === "number" &&
    Number.isFinite(timing.start) &&
    Number.isFinite(timing.end)
  );
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function loadEnvFile(filePath) {
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function printSummary(manifest) {
  console.log("");
  console.log(`Input: ${manifest.inputPath}`);
  console.log(`Mode: ${manifest.dryRun ? "dry-run" : "upsert"}`);
  console.log(`Selected: ${manifest.selectedArticles}/${manifest.totalArticles}`);
  if (!manifest.dryRun) {
    console.log(`Manifest: ${path.join(manifest.outputDir, "manifest.json")}`);
  }
}
