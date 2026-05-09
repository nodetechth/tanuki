import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const expectedColumns = {
  materials: ["id", "level", "title", "script_text", "audio_url", "duration", "accent", "created_at"],
  submissions: [
    "id",
    "user_id",
    "material_id",
    "source_type",
    "source_id",
    "tutor_id",
    "access_type",
    "is_test",
    "test_label",
    "audio_url",
    "r2_object_key",
    "duration",
    "file_size",
    "status",
    "error_message",
    "retry_count",
    "azure_raw_json",
    "llm_raw_json",
    "created_at",
  ],
  feedback: [
    "id",
    "submission_id",
    "accuracy_score",
    "fluency_score",
    "completeness_score",
    "good_points",
    "development_points",
    "problem_words",
    "next_focus",
    "ai_comment",
    "llm_raw_json",
    "created_at",
  ],
  user_billing: [
    "user_id",
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_status",
    "trial_ends_at",
    "current_period_ends_at",
    "cancel_at_period_end",
    "free_submission_used",
    "created_at",
    "updated_at",
  ],
  admin_users: [
    "user_id",
    "email",
    "role",
    "is_active",
    "notes",
    "created_at",
    "updated_at",
  ],
  listening_articles: [
    "id",
    "content_type",
    "category",
    "level",
    "level_label",
    "title",
    "description",
    "body",
    "key_words",
    "read_time_minutes",
    "word_count",
    "wpm",
    "audio_url",
    "audio_sources",
    "published_at",
    "created_at",
    "updated_at",
  ],
  user_listening_articles: [
    "user_id",
    "article_id",
    "is_favorite",
    "completed_at",
    "read_completed_at",
    "shadowing_completed_at",
    "saved_at",
    "offline_saved_at",
    "preferred_accent",
    "last_shadowing_submission_id",
    "last_opened_at",
    "created_at",
    "updated_at",
  ],
  user_word_folders: [
    "id",
    "user_id",
    "name",
    "sort_order",
    "is_default",
    "created_at",
    "updated_at",
  ],
  user_saved_words: [
    "id",
    "user_id",
    "folder_id",
    "word_id",
    "word",
    "normalized_word",
    "level",
    "purpose",
    "note",
    "status",
    "last_reviewed_at",
    "review_count",
    "is_archived",
    "saved_at",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  words: [
    "id",
    "headword",
    "phonetic_jp",
    "ipa",
    "definitions",
    "usage_notes",
    "synonyms",
    "created_at",
    "updated_at",
  ],
  word_examples: [
    "id",
    "word_id",
    "level",
    "purpose",
    "sentence_en",
    "sentence_jp",
    "created_at",
    "updated_at",
  ],
  word_requests: ["id", "user_id", "query", "status", "created_at", "updated_at"],
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const projectLabel = supabaseUrl
  .replace(/^https:\/\//, "")
  .replace(/\.supabase\.co.*/, ".supabase.co");

console.log(`Supabase project: ${projectLabel}`);

let hasError = false;

for (const [table, columns] of Object.entries(expectedColumns)) {
  const { count, error } = await supabase
    .from(table)
    .select(columns.join(","), { count: "exact", head: true });

  if (error) {
    hasError = true;
    console.log(
      `NG ${table}: ${[
        error.code,
        error.message,
        error.details,
        error.hint,
      ]
        .filter(Boolean)
        .join(" | ") || JSON.stringify(error)}`,
    );
    await printColumnStatus(table, columns);
  } else {
    console.log(`OK ${table}: columns present, count=${count ?? "unknown"}`);
  }
}

if (hasError) {
  process.exitCode = 1;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

async function printColumnStatus(table, columns) {
  const missing = [];
  const present = [];

  for (const column of columns) {
    const { error } = await supabase.from(table).select(column, { head: true }).limit(0);
    if (error) {
      missing.push(column);
    } else {
      present.push(column);
    }
  }

  if (present.length) {
    console.log(`  present: ${present.join(", ")}`);
  }
  if (missing.length) {
    console.log(`  missing or unreadable: ${missing.join(", ")}`);
  }
}
