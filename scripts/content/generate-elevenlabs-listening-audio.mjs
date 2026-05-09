import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");

const DEFAULT_INPUT = "templates/listening-articles.batch.template.json";
const DEFAULT_OUTPUT_ROOT = "scripts/content/audio-output";
const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_ACCENTS = ["us", "uk"];

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
  const updateInput = options.updateInput === "true";
  const outputRoot = path.resolve(PROJECT_ROOT, options.output ?? DEFAULT_OUTPUT_ROOT);
  const runId = options.runId ?? `${batch.batchId ?? "elevenlabs-listening"}-${timestamp()}`;
  const outputDir = path.join(outputRoot, runId);
  const accents = splitCsv(options.accents).length ? splitCsv(options.accents) : DEFAULT_ACCENTS;
  const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
  const audioExtension = extensionFromOutputFormat(outputFormat);
  const apiKey = dryRun ? null : requiredEnv("ELEVENLABS_API_KEY");
  const updatedBatch = structuredClone(batch);

  const selectedArticles = updatedBatch.articles.filter((article) => {
    if (only.size && !only.has(article.id)) return false;
    if (article.contentType !== "listening") return false;
    const provider = article.tts?.provider ?? "";
    if (provider && provider !== "elevenlabs") return false;
    const status = article.tts?.status ?? "pending";
    const missingAudio = accents.some((accent) => !article.audioSources?.[accent]);
    const missingTiming = article.paragraphs?.some((paragraph) =>
      paragraph.sentences?.some((sentence) =>
        accents.some(
          (accent) =>
            !sentence.timings?.[accent] ||
            typeof sentence.timings[accent].start !== "number" ||
            typeof sentence.timings[accent].end !== "number",
        ),
      ),
    );
    return force || status === "pending" || missingAudio || missingTiming;
  });

  const manifest = {
    runId,
    inputPath,
    outputDir,
    generatedAt: new Date().toISOString(),
    dryRun,
    outputFormat,
    accents,
    totalArticles: batch.articles.length,
    selectedArticles: selectedArticles.length,
    results: [],
  };

  if (!dryRun) {
    await fs.mkdir(outputDir, { recursive: true });
  }

  for (const article of selectedArticles) {
    const result = await generateListeningArticle({
      article,
      accents,
      apiKey,
      outputDir,
      outputFormat,
      audioExtension,
      dryRun,
      options,
    });
    manifest.results.push(result);
  }

  if (!dryRun) {
    const updatedJsonPath = path.join(outputDir, "updated-listening-articles.json");
    await fs.writeFile(updatedJsonPath, `${JSON.stringify(updatedBatch, null, 2)}\n`);
    manifest.updatedJsonPath = updatedJsonPath;
    if (updateInput) {
      await fs.writeFile(inputPath, `${JSON.stringify(updatedBatch, null, 2)}\n`);
      manifest.inputUpdated = true;
    }
    await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    console.log(JSON.stringify(manifest, null, 2));
  }

  printSummary(manifest);
}

async function generateListeningArticle({
  article,
  accents,
  apiKey,
  outputDir,
  outputFormat,
  audioExtension,
  dryRun,
  options,
}) {
  const startedAt = Date.now();
  const articleResult = {
    id: article.id,
    status: "completed",
    durationMs: 0,
    accents: [],
  };

  try {
    validateListeningArticle(article, accents, dryRun);
    const textPlan = buildTextPlan(article);

    for (const accent of accents) {
      const voice = resolveVoice(article, accent, dryRun);
      const model = options.model ?? article.tts?.model ?? DEFAULT_MODEL;
      const relativeFilePath = path
        .join("listening", safeFileName(article.id), `${safeFileName(article.id)}-${accent}-${safeFileName(model)}.${audioExtension}`)
        .replaceAll(path.sep, "/");
      const filePath = path.join(outputDir, relativeFilePath);
      const alignmentPath = path.join(
        outputDir,
        "alignments",
        safeFileName(article.id),
        `${accent}.json`,
      );

      if (dryRun) {
        articleResult.accents.push({
          accent,
          status: "dry-run",
          voiceId: voice.voiceId,
          label: voice.label,
          model,
          relativeFilePath,
          characterCount: textPlan.text.length,
          sentenceCount: textPlan.sentences.length,
        });
        continue;
      }

      const response = await requestSpeechWithTimestamps({
        apiKey,
        voiceId: voice.voiceId,
        text: textPlan.text,
        model,
        outputFormat,
        voiceSettings: voice.voiceSettings ?? article.tts?.voiceSettings,
      });
      const audioBuffer = Buffer.from(response.audio_base64, "base64");
      const alignment = response.alignment ?? response.normalized_alignment;
      if (!alignment) {
        throw new Error(`ElevenLabs response for ${article.id}/${accent} did not include alignment.`);
      }

      const timings = timingsFromAlignment(textPlan, alignment);
      applyTimings(article, accent, timings);
      if (options.urlPrefix) {
        article.audioSources = article.audioSources ?? {};
        article.audioSources[accent] = `${options.urlPrefix.replace(/\/$/, "")}/${relativeFilePath}`;
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.mkdir(path.dirname(alignmentPath), { recursive: true });
      await fs.writeFile(filePath, audioBuffer);
      await fs.writeFile(
        alignmentPath,
        `${JSON.stringify({ alignment, timings, text: textPlan.text }, null, 2)}\n`,
      );

      articleResult.accents.push({
        accent,
        status: "completed",
        voiceId: voice.voiceId,
        label: voice.label,
        model,
        filePath,
        relativeFilePath,
        alignmentPath,
        bytes: audioBuffer.length,
        sentenceCount: timings.size,
      });
    }

    articleResult.durationMs = Date.now() - startedAt;
    return articleResult;
  } catch (error) {
    return {
      id: article.id ?? "unknown",
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      accents: articleResult.accents,
    };
  }
}

async function requestSpeechWithTimestamps({ apiKey, voiceId, text, model, outputFormat, voiceSettings }) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`);
  url.searchParams.set("output_format", outputFormat);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: model,
      language_code: "en",
      ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${responseText}`);
  }
  return JSON.parse(responseText);
}

function buildTextPlan(article) {
  const chunks = [];
  const sentences = [];
  let cursor = 0;

  for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
    if (paragraphIndex > 0) {
      chunks.push("\n\n");
      cursor += 2;
    }
    const paragraphSentences = paragraph.sentences ?? [];
    for (const [sentenceIndex, sentence] of paragraphSentences.entries()) {
      if (sentenceIndex > 0) {
        chunks.push(" ");
        cursor += 1;
      }
      const text = sentence.en.trim();
      const startIndex = cursor;
      chunks.push(text);
      cursor += text.length;
      sentences.push({
        id: sentence.id,
        startIndex,
        endIndex: cursor,
      });
    }
  }

  return {
    text: chunks.join(""),
    sentences,
  };
}

function timingsFromAlignment(textPlan, alignment) {
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? [];
  const timings = new Map();

  for (const sentence of textPlan.sentences) {
    const firstIndex = firstSpokenIndex(textPlan.text, sentence.startIndex, sentence.endIndex, starts);
    const lastIndex = lastSpokenIndex(textPlan.text, sentence.startIndex, sentence.endIndex, ends);
    if (firstIndex === -1 || lastIndex === -1) {
      throw new Error(`Could not calculate timing for sentence ${sentence.id}.`);
    }
    timings.set(sentence.id, {
      start: roundSeconds(starts[firstIndex]),
      end: roundSeconds(ends[lastIndex]),
    });
  }

  return timings;
}

function firstSpokenIndex(text, startIndex, endIndex, starts) {
  for (let index = startIndex; index < endIndex && index < starts.length; index += 1) {
    if (!/\s/.test(text[index]) && Number.isFinite(starts[index])) {
      return index;
    }
  }
  return -1;
}

function lastSpokenIndex(text, startIndex, endIndex, ends) {
  for (let index = Math.min(endIndex - 1, ends.length - 1); index >= startIndex; index -= 1) {
    if (!/\s/.test(text[index]) && Number.isFinite(ends[index])) {
      return index;
    }
  }
  return -1;
}

function applyTimings(article, accent, timings) {
  for (const paragraph of article.paragraphs) {
    for (const sentence of paragraph.sentences ?? []) {
      const timing = timings.get(sentence.id);
      if (!timing) continue;
      sentence.timings = sentence.timings ?? {};
      sentence.timings[accent] = timing;
      if (accent === "us") {
        sentence.start = timing.start;
        sentence.end = timing.end;
      }
    }
  }
}

function validateListeningArticle(article, accents, dryRun) {
  if (article.contentType !== "listening") {
    throw new Error(`${article.id} is not a listening article.`);
  }
  if (!Array.isArray(article.paragraphs) || !article.paragraphs.length) {
    throw new Error(`${article.id} must have paragraphs.`);
  }
  for (const accent of accents) {
    resolveVoice(article, accent, dryRun);
  }
  for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
    if (!Array.isArray(paragraph.sentences) || !paragraph.sentences.length) {
      throw new Error(`${article.id} paragraph ${paragraphIndex + 1} must have sentences[].`);
    }
    for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
      if (!sentence.id || !sentence.en?.trim()) {
        throw new Error(`${article.id} paragraph ${paragraphIndex + 1} sentence ${sentenceIndex + 1} is missing id/en.`);
      }
    }
  }
}

function resolveVoice(article, accent, allowPlaceholder = false) {
  const voice = article.tts?.voices?.[accent] ?? {};
  const envKey = accent === "uk" ? "ELEVENLABS_UK_VOICE_ID" : "ELEVENLABS_US_VOICE_ID";
  const fallbackVoiceId = allowPlaceholder ? voice.voiceId : "";
  const voiceId = normalizeVoiceId(voice.voiceId) || normalizeVoiceId(process.env[envKey]) || fallbackVoiceId;
  if (!voiceId) {
    throw new Error(`${article.id} is missing ${accent} voiceId. Set tts.voices.${accent}.voiceId or ${envKey}.`);
  }
  return {
    ...voice,
    voiceId,
    label: voice.label ?? (accent === "uk" ? "British English" : "American English"),
  };
}

function normalizeVoiceId(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text || text.startsWith("ELEVENLABS_")) return "";
  return text;
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

function extensionFromOutputFormat(outputFormat) {
  const codec = outputFormat.split("_")[0];
  return codec === "mpeg" ? "mp3" : codec;
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

function roundSeconds(value) {
  return Number(Number(value).toFixed(3));
}

function printSummary(manifest) {
  console.log(`ElevenLabs listening audio run: ${manifest.runId}`);
  console.log(`Output: ${manifest.outputDir}`);
  for (const result of manifest.results) {
    if (result.status === "failed") {
      console.log(`FAILED  ${result.id}: ${result.error}`);
      continue;
    }
    for (const accent of result.accents) {
      const label = `${result.id}/${accent.accent}`;
      if (accent.status === "dry-run") {
        console.log(
          `DRYRUN  ${label} -> ${accent.relativeFilePath} (${accent.sentenceCount} sentences, ${accent.characterCount} chars)`,
        );
      } else {
        console.log(
          `OK      ${label} -> ${accent.relativeFilePath} (${accent.sentenceCount} sentences, ${accent.bytes} bytes)`,
        );
      }
    }
  }
  if (manifest.updatedJsonPath) {
    console.log(`Updated JSON: ${manifest.updatedJsonPath}`);
  }
}
