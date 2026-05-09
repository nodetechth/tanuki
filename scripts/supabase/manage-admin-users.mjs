import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const ROLES = new Set(["admin", "owner"]);

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
  if (options.add === "true") {
    await addAdminUser({ supabase, options });
    return;
  }

  if (options.activate === "true" || options.deactivate === "true") {
    await updateActiveStatus({ supabase, options, isActive: options.activate === "true" });
    return;
  }

  await listAdminUsers({ supabase, options });
}

async function listAdminUsers({ supabase, options }) {
  const includeInactive = options.includeInactive === "true";
  let query = supabase
    .from("admin_users")
    .select("user_id, email, role, is_active, notes, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`admin_users fetch failed: ${error.message}`);
  }

  console.log(JSON.stringify(data ?? [], null, 2));
}

async function addAdminUser({ supabase, options }) {
  const email = normalizeEmail(requiredOption(options.email, "--email"));
  const role = roleOption(options.role ?? "admin");
  const dryRun = options.dryRun !== "false";
  const notes = String(options.notes ?? "");
  const userId = options["user-id"] ?? (await findAuthUserIdByEmail(supabase, email));

  if (!userId) {
    throw new Error(
      `No Supabase Auth user found for ${email}. Ask the user to log in once, or pass --user-id manually.`,
    );
  }

  const row = {
    user_id: userId,
    email,
    role,
    is_active: true,
    notes,
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(JSON.stringify({ status: "dry-run", action: "add", row }, null, 2));
    return;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .upsert(row, { onConflict: "user_id" })
    .select("user_id, email, role, is_active, notes, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`admin_users upsert failed: ${error.message}`);
  }

  console.log(JSON.stringify({ status: "completed", action: "add", row: data }, null, 2));
}

async function updateActiveStatus({ supabase, options, isActive }) {
  const dryRun = options.dryRun !== "false";
  const email = options.email ? normalizeEmail(options.email) : null;
  const userId = options["user-id"] ?? null;

  if (!email && !userId) {
    throw new Error("Pass --email or --user-id.");
  }

  const update = {
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          status: "dry-run",
          action: isActive ? "activate" : "deactivate",
          target: { email, userId },
          update,
        },
        null,
        2,
      ),
    );
    return;
  }

  let query = supabase
    .from("admin_users")
    .update(update)
    .select("user_id, email, role, is_active, notes, created_at, updated_at");

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("email", email);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`admin_users update failed: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        status: "completed",
        action: isActive ? "activate" : "deactivate",
        updatedRows: data?.length ?? 0,
        rows: data ?? [],
      },
      null,
      2,
    ),
  );
}

async function findAuthUserIdByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Supabase Auth user lookup failed: ${error.message}`);
    }

    const user = data.users.find((item) => normalizeEmail(item.email) === email);
    if (user) {
      return user.id;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  throw new Error("Supabase Auth user lookup stopped after 20000 users. Pass --user-id manually.");
}

function roleOption(value) {
  if (!ROLES.has(value)) {
    throw new Error(`Invalid role: ${value}. Use admin or owner.`);
  }
  return value;
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function requiredOption(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
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
  npm run db:admin-users
  npm run db:admin-users -- --includeInactive true
  npm run db:admin-users -- --add --email owner@example.com --role owner
  npm run db:admin-users -- --add --email owner@example.com --role owner --dry-run false
  npm run db:admin-users -- --deactivate --email owner@example.com --dry-run false
  npm run db:admin-users -- --activate --email owner@example.com --dry-run false

Options:
  --add
  --activate
  --deactivate
  --email <email>
  --user-id <supabase-auth-user-id>
  --role admin|owner
  --notes <text>
  --includeInactive true
  --dry-run false
`.trim());
}
