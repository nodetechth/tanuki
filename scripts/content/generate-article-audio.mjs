import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");

const DEFAULT_INPUT = "templates/listening-articles.batch.template.json";
const DEFAULT_OUTPUT_ROOT = "scripts/content/audio-output";
const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "coral";
const DEFAULT_FORMAT = "mp3";
const DEFAULT_BASE_WPM = 150;
const DEFAULT_MIN_SPEED = 0.7;
const DEFAULT_MAX_SPEED = 1.25;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env"));

  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(PROJECT_ROOT, options.input ?? DEFAULT_INPUT);
  const batch = JSON.parse(await fs.readFile(inputPath, "utf8"));

  if (!Array.isArray(batch.articles)) {
    throw new Error("Input JSON must contain an articles array.");
  }

  const only = new Set(splitCsv(options.only));
  const force = options.force === "true";
  const dryRun = options.dryRun === "true";
  const outputRoot = path.resolve(PROJECT_ROOT, options.output ?? DEFAULT_OUTPUT_ROOT);
  const runId = options.runId ?? `${batch.batchId ?? "article-audio"}-${timestamp()}`;
  const outputDir = path.join(outputRoot, runId);
  const defaults = batch.ttsDefaults ?? {};

  const model = options.model ?? defaults.model ?? DEFAULT_MODEL;
  if (model !== DEFAULT_MODEL) {
    console.warn(`Warning: expected ${DEFAULT_MODEL}, got ${model}.`);
  }

  const selectedArticles = batch.articles.filter((article) => {
    if (only.size && !only.has(article.id)) return false;
    const status = article.tts?.status ?? "pending";
    return force || status === "pending" || !article.audioUrl;
  });

  const manifest = {
    runId,
    inputPath,
    outputDir,
    generatedAt: new Date().toISOString(),
    model,
    dryRun,
    totalArticles: batch.articles.length,
    selectedArticles: selectedArticles.length,
    results: [],
  };

  if (!selectedArticles.length) {
    await writeManifest(outputDir, manifest, dryRun);
    printSummary(manifest);
    return;
  }

  const openai = dryRun ? null : new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  if (!dryRun) {
    await fs.mkdir(outputDir, { recursive: true });
  }

  for (const article of selectedArticles) {
    const result = await generateArticleAudio({
      article,
      defaults,
      model,
      openai,
      outputDir,
      dryRun,
      options,
    });
    manifest.results.push(result);
  }

  await writeManifest(outputDir, manifest, dryRun);
  printSummary(manifest);
}

async function generateArticleAudio({ article, defaults, model, openai, outputDir, dryRun, options }) {
  const startedAt = Date.now();
  try {
    validateArticle(article);
    const provider = article.tts?.provider ?? defaults.provider ?? "openai";
    if (provider !== "openai") {
      const accentCount =
        provider === "elevenlabs" && article.contentType === "listening"
          ? Object.keys(article.tts?.voices ?? {}).length
          : 0;
      return {
        id: article.id,
        status: "skipped",
        durationMs: Date.now() - startedAt,
        provider,
        accentCount,
        reason:
          "This script generates OpenAI TTS only. Use the ElevenLabs timestamp workflow for listening articles and generate both us/uk audio files.",
      };
    }
    const format = options.format ?? article.tts?.responseFormat ?? defaults.responseFormat ?? DEFAULT_FORMAT;
    const voice = options.voice ?? article.tts?.voice ?? defaults.voice ?? process.env.OPENAI_TTS_VOICE ?? DEFAULT_VOICE;
    const targetWpm = Number(options.wpm ?? article.wpm);
    const baseWpm = Number(options.baseWpm ?? defaults.baseWpm ?? DEFAULT_BASE_WPM);
    const speed =
      options.speed !== undefined
        ? Number(options.speed)
        : article.tts?.speed !== undefined
          ? Number(article.tts.speed)
          : speedFromWpm(targetWpm, baseWpm);
    const clampedSpeed = clamp(speed, DEFAULT_MIN_SPEED, DEFAULT_MAX_SPEED);
    const text = article.paragraphs
      .map((paragraph) =>
        article.contentType === "listening" && Array.isArray(paragraph.sentences) && paragraph.sentences.length
          ? paragraph.sentences.map((sentence) => sentence.en.trim()).join(" ")
          : paragraph.en.trim(),
      )
      .join("\n\n");
    const expectedSeconds = Math.round((Number(article.wordCount) / targetWpm) * 60);
    const instructions = buildInstructions({ article, defaults, targetWpm });
    const relativeFilePath = path.join(
      article.contentType,
      safeFileName(article.id),
      `${safeFileName(model)}-${safeFileName(voice)}-${targetWpm}wpm.${format}`,
    );
    const filePath = path.join(outputDir, relativeFilePath);

    if (!dryRun) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const response = await openai.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: format,
        speed: clampedSpeed,
        instructions,
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      return {
        id: article.id,
        status: "completed",
        filePath,
        relativeFilePath,
        bytes: buffer.length,
        durationMs: Date.now() - startedAt,
        targetWpm,
        expectedSeconds,
        speed: clampedSpeed,
        voice,
        model,
      };
    }

    return {
      id: article.id,
      status: "dry-run",
      relativeFilePath,
      durationMs: Date.now() - startedAt,
      targetWpm,
      expectedSeconds,
      speed: clampedSpeed,
      voice,
      model,
      characterCount: text.length,
    };
  } catch (error) {
    return {
      id: article.id ?? "unknown",
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateArticle(article) {
  const required = ["id", "contentType", "title", "wordCount", "paragraphs"];
  for (const key of required) {
    if (article[key] === undefined || article[key] === null || article[key] === "") {
      throw new Error(`Article is missing ${key}.`);
    }
  }
  if (!["shadowing", "listening"].includes(article.contentType)) {
    throw new Error(`Invalid contentType: ${article.contentType}`);
  }
  if (!Array.isArray(article.paragraphs) || article.paragraphs.length === 0) {
    throw new Error("Article must contain at least one paragraph.");
  }
  for (const [index, paragraph] of article.paragraphs.entries()) {
    if (!paragraph.en?.trim()) {
      throw new Error(`Paragraph ${index + 1} is missing English text.`);
    }
    if (article.contentType === "listening") {
      if (!Array.isArray(paragraph.sentences) || paragraph.sentences.length === 0) {
        throw new Error(`Listening paragraph ${index + 1} must include sentences[].`);
      }
      for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
        if (!sentence.id || !sentence.en?.trim() || !sentence.ja?.trim()) {
          throw new Error(
            `Listening paragraph ${index + 1}, sentence ${sentenceIndex + 1} is missing id/en/ja.`,
          );
        }
        if (!("start" in sentence) || !("end" in sentence)) {
          throw new Error(
            `Listening paragraph ${index + 1}, sentence ${sentenceIndex + 1} is missing start/end.`,
          );
        }
        if (sentence.timings) {
          for (const accent of ["us", "uk"]) {
            if (
              !sentence.timings[accent] ||
              !("start" in sentence.timings[accent]) ||
              !("end" in sentence.timings[accent])
            ) {
              throw new Error(
                `Listening paragraph ${index + 1}, sentence ${sentenceIndex + 1} has invalid timings.${accent}.`,
              );
            }
          }
        }
      }
    }
  }
  if (
    article.contentType === "shadowing" &&
    (!Number.isFinite(Number(article.wpm)) || Number(article.wpm) <= 0)
  ) {
    throw new Error(`Invalid shadowing wpm: ${article.wpm}`);
  }
  if (article.contentType === "listening" && article.wpm != null) {
    throw new Error("Listening articles must not include wpm. Use the ElevenLabs workflow for listening audio.");
  }
  if (!Number.isFinite(Number(article.wordCount)) || Number(article.wordCount) <= 0) {
    throw new Error(`Invalid wordCount: ${article.wordCount}`);
  }
}

function buildInstructions({ article, defaults, targetWpm }) {
  const base = article.tts?.instructions ?? defaults.instructions ?? "";
  const contentInstruction =
    article.contentType === "shadowing"
      ? "This is a shadowing exercise. Keep the rhythm steady, articulate consonants clearly, and make it easy for learners to repeat."
      : "This is a listening exercise. Keep a natural, calm pace with clear paragraph-level pauses.";

  return [
    base,
    contentInstruction,
    `Target speaking speed: about ${targetWpm} words per minute.`,
    "Do not read headings, labels, translations, or metadata. Read only the English article text.",
  ]
    .filter(Boolean)
    .join(" ");
}

function speedFromWpm(targetWpm, baseWpm) {
  return Number((targetWpm / baseWpm).toFixed(2));
}

async function writeManifest(outputDir, manifest, dryRun) {
  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function printSummary(manifest) {
  console.log(`Article audio run: ${manifest.runId}`);
  console.log(`Output: ${manifest.outputDir}`);
  for (const result of manifest.results) {
    if (result.status === "completed") {
      console.log(
        `OK      ${result.id} -> ${result.relativeFilePath} (${result.targetWpm} WPM, speed ${result.speed}, ${result.bytes} bytes)`,
      );
    } else if (result.status === "skipped") {
      console.log(`SKIP    ${result.id}: ${result.reason}`);
    } else if (result.status === "dry-run") {
      console.log(
        `DRYRUN  ${result.id} -> ${result.relativeFilePath} (${result.targetWpm} WPM, speed ${result.speed}, ${result.characterCount} chars)`,
      );
    } else {
      console.log(`FAILED  ${result.id}: ${result.error}`);
    }
  }
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadEnvFile(filePath) {
  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
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
    })
    .catch(() => {});
}

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set.`);
  }
  return value;
}

function safeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
