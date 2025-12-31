// migrateData.js
import dotenv from 'dotenv';
dotenv.config(); // Load .env at the top

import { createClient } from '@supabase/supabase-js';

// --- OLD Supabase Project ---
// --- OLD Supabase ---
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_ANON_KEY = process.env.OLD_SUPABASE_ANON_KEY;

// --- NEW Supabase ---
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL;
const NEW_SUPABASE_ANON_KEY = process.env.NEW_SUPABASE_ANON_KEY;

// Check if variables are loaded
console.log(OLD_SUPABASE_ANON_KEY)
if (!OLD_SUPABASE_URL || !OLD_SUPABASE_ANON_KEY || !NEW_SUPABASE_URL || !NEW_SUPABASE_ANON_KEY) {
  console.error("❌ One or more environment variables are missing. Check your .env file.");
  process.exit(1);
}

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_ANON_KEY);

// Tables to migrate
const tables = [  'customers',
  'tickets',
  'tasks',
  'settings']; // Add or remove tables as needed

async function migrateTable(tableName) {
  console.log(`\n🔹 Fetching ${tableName} from OLD project...`);

  const { data, error } = await oldSupabase.from(tableName).select('*');
  if (error) {
    console.error(`❌ Fetch error (${tableName}):`, error.message);
    return;
  }

  if (!data?.length) {
    console.log(`⚪ ${tableName} empty, skipping.`);
    return;
  }

  let transformedData = data;

  if (tableName === 'tasks') {
    transformedData = data.map(({ text, assigned_to, ...rest }) => ({
      ...rest,
      title: text,
      assigned_to_id: assigned_to
    }));
  }

  const { error: insertError } = await newSupabase
    .from(tableName)
    .upsert(transformedData, { onConflict: 'id' });

  if (insertError) {
    console.error(`❌ Insert error (${tableName}):`, insertError.message);
  } else {
    console.log(`✅ ${tableName} migrated (${transformedData.length} rows)`);
  }
}


async function migrateAll() {
  console.log("🚀 Starting migration...");
  for (const table of tables) {
    await migrateTable(table);
  }
  console.log("\n🎉 Migration complete!");
}

// Run the migration
migrateAll().catch(err => console.error("Unexpected Error:", err));
