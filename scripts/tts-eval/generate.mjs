import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");

const OPENAI_MODELS = [
  { id: "gpt-4o-mini-tts", label: "openai-gpt-4o-mini-tts", supportsInstructions: true },
  { id: "tts-1", label: "openai-tts-1", supportsInstructions: false },
  { id: "tts-1-hd", label: "openai-tts-1-hd", supportsInstructions: false },
];

const ELEVENLABS_MODELS = [
  { id: "eleven_multilingual_v2", label: "elevenlabs-multilingual-v2" },
  { id: "eleven_flash_v2_5", label: "elevenlabs-flash-v2-5" },
];

const DEFAULT_OPENAI_VOICE = "coral";
const DEFAULT_FORMAT = "mp3";
const DEFAULT_INSTRUCTIONS =
  "Speak clearly in natural American English for an English-learning listening exercise. Keep a calm, professional tone and use natural sentence stress.";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env"));

  const options = parseArgs(process.argv.slice(2));
  const textPath = path.resolve(PROJECT_ROOT, options.text ?? "scripts/tts-eval/manuscript.txt");
  const text = await fs.readFile(textPath, "utf8");
  const outputRoot = path.resolve(PROJECT_ROOT, options.output ?? "scripts/tts-eval/output");
  const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const outputDir = path.join(outputRoot, runId);
  await fs.mkdir(outputDir, { recursive: true });

  const selected = new Set(splitCsv(options.only));
  const format = options.format ?? DEFAULT_FORMAT;
  const openaiVoice = options.openaiVoice ?? options.voice ?? process.env.OPENAI_TTS_VOICE ?? DEFAULT_OPENAI_VOICE;
  const elevenLabsVoiceId = options.elevenLabsVoiceId ?? options.voice ?? process.env.ELEVENLABS_VOICE_ID;
  const instructions = options.instructions ?? process.env.OPENAI_TTS_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS;
  const speed = Number(options.speed ?? process.env.OPENAI_TTS_SPEED ?? 1);

  const manifest = {
    runId,
    generatedAt: new Date().toISOString(),
    textPath,
    outputDir,
    characterCount: text.length,
    settings: {
      format,
      openaiVoice,
      elevenLabsVoiceId: elevenLabsVoiceId ? mask(elevenLabsVoiceId) : null,
      speed,
      instructions,
    },
    results: [],
  };

  const shouldRun = (label) => selected.size === 0 || selected.has(label);

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    for (const model of OPENAI_MODELS) {
      if (!shouldRun(model.label) && !shouldRun(model.id)) continue;
      const filePath = path.join(outputDir, `${model.label}.${format}`);
      manifest.results.push(await generateOpenAiSpeech({ openai, model, text, filePath, format, openaiVoice, instructions, speed }));
    }
  } else {
    for (const model of OPENAI_MODELS) {
      manifest.results.push(skipped(model.label, "OPENAI_API_KEY is not set."));
    }
  }

  if (process.env.ELEVENLABS_API_KEY && elevenLabsVoiceId) {
    for (const model of ELEVENLABS_MODELS) {
      if (!shouldRun(model.label) && !shouldRun(model.id)) continue;
      const filePath = path.join(outputDir, `${model.label}.mp3`);
      manifest.results.push(
        await generateElevenLabsSpeech({
          model,
          text,
          filePath,
          voiceId: elevenLabsVoiceId,
          apiKey: process.env.ELEVENLABS_API_KEY,
          speed,
        }),
      );
    }
  } else {
    const reason = !process.env.ELEVENLABS_API_KEY
      ? "ELEVENLABS_API_KEY is not set."
      : "ELEVENLABS_VOICE_ID is not set.";
    for (const model of ELEVENLABS_MODELS) {
      manifest.results.push(skipped(model.label, reason));
    }
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  printSummary(manifest, manifestPath);
}

async function generateOpenAiSpeech({ openai, model, text, filePath, format, openaiVoice, instructions, speed }) {
  const startedAt = Date.now();
  try {
    const response = await openai.audio.speech.create({
      model: model.id,
      voice: openaiVoice,
      input: text,
      response_format: format,
      speed,
      ...(model.supportsInstructions ? { instructions } : {}),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return completed(model.label, filePath, startedAt, buffer.length);
  } catch (error) {
    return failed(model.label, startedAt, error);
  }
}

async function generateElevenLabsSpeech({ model, text, filePath, voiceId, apiKey, speed }) {
  const startedAt = Date.now();
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          accept: "audio/mpeg",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: model.id,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
            speed: clamp(speed, 0.7, 1.2),
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${body}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return completed(model.label, filePath, startedAt, buffer.length);
  } catch (error) {
    return failed(model.label, startedAt, error);
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

function completed(label, filePath, startedAt, bytes) {
  return {
    label,
    status: "completed",
    filePath,
    bytes,
    durationMs: Date.now() - startedAt,
  };
}

function skipped(label, reason) {
  return {
    label,
    status: "skipped",
    reason,
  };
}

function failed(label, startedAt, error) {
  return {
    label,
    status: "failed",
    durationMs: Date.now() - startedAt,
    error: error instanceof Error ? error.message : String(error),
  };
}

function printSummary(manifest, manifestPath) {
  console.log(`TTS eval output: ${manifest.outputDir}`);
  for (const result of manifest.results) {
    if (result.status === "completed") {
      console.log(`OK      ${result.label} -> ${result.filePath} (${result.bytes} bytes, ${result.durationMs}ms)`);
    } else if (result.status === "skipped") {
      console.log(`SKIP    ${result.label}: ${result.reason}`);
    } else {
      console.log(`FAILED  ${result.label}: ${result.error}`);
    }
  }
  console.log(`Manifest: ${manifestPath}`);
}

function mask(value) {
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
