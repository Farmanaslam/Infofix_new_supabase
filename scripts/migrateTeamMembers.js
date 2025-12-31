// migrateTeamMembers.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// --- OLD Supabase ---
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_ANON_KEY = process.env.OLD_SUPABASE_ANON_KEY;
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);

// --- NEW Supabase ---
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL;
const NEW_SUPABASE_ANON_KEY = process.env.NEW_SUPABASE_ANON_KEY;
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_ANON_KEY);

// --- Migrate team members from settings JSON ---
async function migrateTeamMembers() {
  console.log("Fetching team members from old settings...");
  const { data: settingsData, error: settingsError } = await oldSupabase
    .from('settings')
    .select('team_members')
    .maybeSingle();

  if (settingsError) {
    console.error("Error fetching settings:", settingsError.message);
    return;
  }

  if (!settingsData || !settingsData.team_members) {
    console.log("No team members found in old settings.");
    return;
  }

  const teamMembers = settingsData.team_members; // JSON array of members
  console.log(`Found ${teamMembers.length} team members. Inserting into new users table...`);

  for (const member of teamMembers) {
    // Adjust fields according to your new users table structure
    const { id, name, email, password, role, details, experience } = member;

    const { data, error } = await newSupabase.from('users').insert([{
      id, // keep same ID if you want to preserve references
      name,
      email,
      password, // plaintext? make sure to hash if needed
      role,
      details,
      experience,
    }]);

    if (error) {
      console.error(`Error inserting member ${email}:`, error.message);
    } else {
      console.log(`Inserted member: ${email}`);
    }
  }

  console.log("Team members migration complete ✅");
}

migrateTeamMembers();
