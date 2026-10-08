import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const env = {};
  if (!fs.existsSync(path)) return env;
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

const env = { ...loadEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.ADMIN_USER_EMAIL?.toLowerCase();
const password = env.ADMIN_USER_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!email || !password) {
  console.error(
    "Missing ADMIN_USER_EMAIL or ADMIN_USER_PASSWORD. Set them in .env.local or as environment variables before running this script."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    if (!data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function main() {
  const users = await listAllUsers();
  const existing = users.find((user) => user.email?.toLowerCase() === email);

  if (existing) {
    const currentMeta = existing.app_metadata ?? {};
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...currentMeta, role: "admin" },
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        role: "admin",
        name: "nicchyo admin",
      },
    });
    if (error) throw error;
    console.log(`Updated existing admin user: ${email}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { role: "admin", name: "nicchyo admin" },
  });
  if (error) throw error;

  console.log(`Created admin user: ${data.user?.email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
