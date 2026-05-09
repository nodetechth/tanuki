import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const STATUSES = new Set(["pending", "added", "dismissed"]);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  await loadEnvFile(path.join(PROJECT_ROOT, ".env"));

  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const supabase = createSupabaseClient();
  if (options["mark-added"] === "true" || options["mark-dismissed"] === "true") {
    await updateRequests({ supabase, options });
    return;
  }

  await listRequests({ supabase, options });
}

async function listRequests({ supabase, options }) {
  const status = statusOption(options.status ?? "pending");
  const limit = positiveInteger(options.limit, 2000);
  const format = options.format ?? "csv";
  const outputPath = options.output ? path.resolve(PROJECT_ROOT, options.output) : null;
  const requests = await fetchRequests({ supabase, status, limit });
  const aggregated = aggregateRequests(requests);
  const payload =
    format === "json"
      ? `${JSON.stringify(aggregated, null, 2)}\n`
      : toCsv(
          aggregated.map((item) => ({
            query: item.query,
            status: item.status,
            count: item.count,
            userCount: item.userCount,
            firstRequestedAt: item.firstRequestedAt,
            lastRequestedAt: item.lastRequestedAt,
            requestIds: item.requestIds.join(" "),
          })),
        );

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, payload);
    console.log(`Wrote ${aggregated.length} word request rows to ${outputPath}`);
  } else {
    process.stdout.write(payload);
  }
}

async function updateRequests({ supabase, options }) {
  const nextStatus = options["mark-added"] === "true" ? "added" : "dismissed";
  const dryRun = options.dryRun !== "false";
  const ids = splitCsv(options.ids);
  const words = await requestedWords(options);

  if (!ids.length && !words.length) {
    throw new Error("Pass --ids or --words/--words-file when updating request status.");
  }

  const target = {
    nextStatus,
    dryRun,
    ids,
    words,
    updatedAt: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...target, status: "dry-run" }, null, 2));
    return;
  }

  let query = supabase
    .from("word_requests")
    .update({
      status: nextStatus,
      updated_at: target.updatedAt,
    })
    .select("id, query, status, updated_at");

  if (ids.length) {
    query = query.in("id", ids);
  } else {
    query = query.in("query", words);
    if (options.includeAll !== "true") {
      query = query.eq("status", "pending");
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`word_requests update failed: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ...target,
        status: "completed",
        updatedRows: data?.length ?? 0,
        rows: data ?? [],
      },
      null,
      2,
    ),
  );
}

async function fetchRequests({ supabase, status, limit }) {
  let query = supabase
    .from("word_requests")
    .select("id, user_id, query, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`word_requests fetch failed: ${error.message}`);
  }
  return data ?? [];
}

function aggregateRequests(requests) {
  const byKey = new Map();
  for (const request of requests) {
    const key = `${request.status}:${request.query}`;
    const current =
      byKey.get(key) ??
      {
        query: request.query,
        status: request.status,
        count: 0,
        users: new Set(),
        requestIds: [],
        firstRequestedAt: request.created_at,
        lastRequestedAt: request.created_at,
      };
    current.count += 1;
    if (request.user_id) current.users.add(request.user_id);
    current.requestIds.push(request.id);
    if (request.created_at < current.firstRequestedAt) current.firstRequestedAt = request.created_at;
    if (request.created_at > current.lastRequestedAt) current.lastRequestedAt = request.created_at;
    byKey.set(key, current);
  }

  return Array.from(byKey.values())
    .map((item) => ({
      query: item.query,
      status: item.status,
      count: item.count,
      userCount: item.users.size,
      firstRequestedAt: item.firstRequestedAt,
      lastRequestedAt: item.lastRequestedAt,
      requestIds: item.requestIds,
    }))
    .sort((a, b) => b.count - a.count || b.lastRequestedAt.localeCompare(a.lastRequestedAt));
}

async function requestedWords(options) {
  const words = splitCsv(options.words).map(normalizeQuery).filter(Boolean);
  if (!options["words-file"]) {
    return Array.from(new Set(words));
  }

  const filePath = path.resolve(PROJECT_ROOT, options["words-file"]);
  const content = await fs.readFile(filePath, "utf8");
  const fileWords = content
    .split(/[\r\n,]+/)
    .map(normalizeQuery)
    .filter(Boolean);
  return Array.from(new Set([...words, ...fileWords])).sort();
}

function normalizeQuery(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function statusOption(value) {
  if (value === "all") return "all";
  if (!STATUSES.has(value)) {
    throw new Error(`Invalid status: ${value}`);
  }
  return value;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCsv(rows) {
  if (!rows.length) return "query,status,count,userCount,firstRequestedAt,lastRequestedAt,requestIds\n";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function createSupabaseClient() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
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

function printUsage() {
  console.log(`
Usage:
  npm run db:word-requests -- --status pending --format csv --output exports/word-requests.csv
  npm run db:word-requests -- --status all --format json
  npm run db:word-requests -- --mark-added --words available,postpone
  npm run db:word-requests -- --mark-added --words-file exports/added-words.txt --dry-run false
  npm run db:word-requests -- --mark-dismissed --ids <id1>,<id2> --dry-run false

Options:
  --status pending|added|dismissed|all
  --format csv|json
  --output <path>
  --limit <number>
  --mark-added
  --mark-dismissed
  --words word1,word2
  --words-file <path>
  --ids id1,id2
  --includeAll true
  --dry-run false
`.trim());
}
