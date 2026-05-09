import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_INPUT = "src/lib/word-dictionary/sample-words.json";
const DEFAULT_OUTPUT_ROOT = "scripts/content/upsert-output";
const LEVELS = ["beginner", "intermediate", "advanced"];
const PURPOSES = ["casual", "business", "toeic"];
const EXPECTED_COMBINATIONS = LEVELS.flatMap((level) =>
  PURPOSES.map((purpose) => `${level}/${purpose}`),
);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env"));

  const options = parseArgs(process.argv.slice(2));
  const checkDb = options.checkDb === "true" || options["check-db"] === "true";
  const dryRun = options.dryRun !== "false";

  if (checkDb) {
    const report = await checkDbExamples();
    console.log(JSON.stringify(report, null, 2));
    if (report.missingWords.length) {
      process.exitCode = 1;
    }
    return;
  }

  const inputPath = path.resolve(PROJECT_ROOT, options.input ?? DEFAULT_INPUT);
  const outputRoot = path.resolve(PROJECT_ROOT, options.output ?? DEFAULT_OUTPUT_ROOT);
  const rawWords = await readWordsInput(inputPath);
  const words = rawWords.map(normalizeWord).sort((a, b) => a.headword.localeCompare(b.headword));
  const duplicateHeadwords = findDuplicates(words.map((word) => word.headword));
  const missingReport = findMissingExamples(words);
  const rows = buildRows(words);
  const runId = `word-dictionary-upsert-${timestamp()}`;
  const manifest = {
    runId,
    inputPath,
    outputDir: path.join(outputRoot, runId),
    generatedAt: new Date().toISOString(),
    dryRun,
    totalWords: words.length,
    duplicateHeadwords,
    missingWords: missingReport,
    wordRows: rows.wordRows.length,
    exampleRows: rows.exampleRows.length,
    expectedExampleRows: words.length * EXPECTED_COMBINATIONS.length,
  };

  if (duplicateHeadwords.length) {
    console.log(JSON.stringify(manifest, null, 2));
    throw new Error(`Duplicate headwords found: ${duplicateHeadwords.join(", ")}`);
  }
  if (missingReport.length && options.allowIncomplete !== "true") {
    console.log(JSON.stringify(manifest, null, 2));
    throw new Error("Some words are missing required 9 examples. Fix them or pass --allow-incomplete true.");
  }

  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2));
    printSummary(manifest);
    return;
  }

  const supabase = createSupabaseClient();
  await upsertRows({ supabase, rows });
  manifest.status = "completed";
  await fs.mkdir(manifest.outputDir, { recursive: true });
  await fs.writeFile(
    path.join(manifest.outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  printSummary(manifest);
}

async function readWordsInput(inputPath) {
  const content = await fs.readFile(inputPath, "utf8");

  if (inputPath.endsWith(".jsonl")) {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseJsonlWord);
  }

  const data = JSON.parse(content);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.words)) return data.words;
  if (Array.isArray(data.items)) return data.items;
  throw new Error("Input JSON must be an array, or contain words/items array.");
}

function parseJsonlWord(line) {
  const item = JSON.parse(line);
  const content =
    item.response?.body?.choices?.[0]?.message?.content ??
    item.choices?.[0]?.message?.content ??
    item.content;

  if (typeof content === "string") {
    return JSON.parse(content.trim());
  }
  if (content && typeof content === "object") {
    return content;
  }
  return item;
}

function normalizeWord(item) {
  const headword = String(item.word ?? item.headword ?? "").trim().toLowerCase();
  if (!headword) {
    throw new Error("Word item is missing word/headword.");
  }

  return {
    headword,
    phonetic_jp: String(item.phonetic_jp ?? item.phoneticJp ?? ""),
    ipa: String(item.ipa ?? item.stress ?? ""),
    definitions: Array.isArray(item.definitions) ? item.definitions : [],
    usage_notes: String(item.usage_notes ?? item.usageNotes ?? ""),
    synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
    examples: item.examples ?? {},
  };
}

function buildRows(words) {
  const wordRows = words.map((word) => ({
    headword: word.headword,
    phonetic_jp: word.phonetic_jp,
    ipa: word.ipa,
    definitions: word.definitions,
    usage_notes: word.usage_notes,
    synonyms: word.synonyms,
  }));
  const exampleRows = [];

  for (const word of words) {
    for (const level of LEVELS) {
      for (const purpose of PURPOSES) {
        const example = word.examples?.[level]?.[purpose];
        if (!example?.sentence_en || !example?.sentence_jp) continue;
        exampleRows.push({
          headword: word.headword,
          level,
          purpose,
          sentence_en: String(example.sentence_en),
          sentence_jp: String(example.sentence_jp),
        });
      }
    }
  }

  return { wordRows, exampleRows };
}

async function upsertRows({ supabase, rows }) {
  const wordIdByHeadword = new Map();

  for (const chunk of chunkArray(rows.wordRows, 500)) {
    const { data, error } = await supabase
      .from("words")
      .upsert(chunk, { onConflict: "headword" })
      .select("id, headword");

    if (error) {
      throw new Error(`words upsert failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      wordIdByHeadword.set(row.headword, row.id);
    }
  }

  const wordExampleRows = rows.exampleRows.map((row) => {
    const wordId = wordIdByHeadword.get(row.headword);
    if (!wordId) {
      throw new Error(`Missing word id after upsert: ${row.headword}`);
    }
    return {
      word_id: wordId,
      level: row.level,
      purpose: row.purpose,
      sentence_en: row.sentence_en,
      sentence_jp: row.sentence_jp,
    };
  });

  for (const chunk of chunkArray(wordExampleRows, 500)) {
    const { error } = await supabase
      .from("word_examples")
      .upsert(chunk, { onConflict: "word_id,level,purpose" });

    if (error) {
      throw new Error(`word_examples upsert failed: ${error.message}`);
    }
  }
}

function findMissingExamples(words) {
  return words
    .map((word) => {
      const missing = EXPECTED_COMBINATIONS.filter((combination) => {
        const [level, purpose] = combination.split("/");
        const example = word.examples?.[level]?.[purpose];
        return !example?.sentence_en || !example?.sentence_jp;
      });
      return missing.length ? { headword: word.headword, missing } : null;
    })
    .filter(Boolean);
}

async function checkDbExamples() {
  const supabase = createSupabaseClient();
  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, headword")
    .order("headword", { ascending: true });

  if (wordsError) {
    throw new Error(`words check failed: ${wordsError.message}`);
  }

  const wordIds = (words ?? []).map((word) => word.id);
  const examplesByWordId = new Map();

  for (const chunk of chunkArray(wordIds, 500)) {
    const { data: examples, error: examplesError } = await supabase
      .from("word_examples")
      .select("word_id, level, purpose, sentence_en, sentence_jp")
      .in("word_id", chunk);

    if (examplesError) {
      throw new Error(`word_examples check failed: ${examplesError.message}`);
    }

    for (const example of examples ?? []) {
      const set = examplesByWordId.get(example.word_id) ?? new Set();
      if (example.sentence_en && example.sentence_jp) {
        set.add(`${example.level}/${example.purpose}`);
      }
      examplesByWordId.set(example.word_id, set);
    }
  }

  const missingWords = (words ?? [])
    .map((word) => {
      const present = examplesByWordId.get(word.id) ?? new Set();
      const missing = EXPECTED_COMBINATIONS.filter((combination) => !present.has(combination));
      return missing.length ? { headword: word.headword, missing } : null;
    })
    .filter(Boolean);

  return {
    checkedAt: new Date().toISOString(),
    totalWords: words?.length ?? 0,
    expectedExamplesPerWord: EXPECTED_COMBINATIONS.length,
    missingWords,
    ok: missingWords.length === 0,
  };
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates).sort();
}

function createSupabaseClient() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
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

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function printSummary(manifest) {
  console.log("");
  console.log(`Input: ${manifest.inputPath}`);
  console.log(`Mode: ${manifest.dryRun ? "dry-run" : "upsert"}`);
  console.log(`Words: ${manifest.totalWords}`);
  console.log(`Examples: ${manifest.exampleRows}/${manifest.expectedExampleRows}`);
  if (!manifest.dryRun) {
    console.log(`Manifest: ${path.join(manifest.outputDir, "manifest.json")}`);
  }
}
