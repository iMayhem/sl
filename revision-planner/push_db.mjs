import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const SUPABASE_URL = 'https://bxhlqokfbgbdvpypuqrk.supabase.co';
// Need the service role key to bypass RLS, OR we need the user to tell us their admin token.
// Wait, the client only has Anon key. If RLS blocks Anon, how did the site write to it?
// Let's check the RLS policies or try to fetch first.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aGxxb2tmYmdiZHZweXB1cXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTYyODgsImV4cCI6MjA4ODgzMjI4OH0.ovVBIr57TDsNEkiZEWh7q4FWa0IL_Bp9cXR-npISUKA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const schedulePath = './src/data/schedule.json';
const localData = JSON.parse(readFileSync(schedulePath, 'utf-8'));

async function pushData() {
    // Let's try an RPC call if there is one, or just update.
    console.log("Attempting to push local json to DB id=1...");

    // Since we know the Anon key might be blocked by RLS for UPDATE, let's see if we can do it via a postgres function if they made one, or just try the update again.
    const { data, error } = await supabase
        .from('global_schedule')
        .update({ schedule_data: localData, updated_at: new Date() })
        .eq('id', 1)
        .select();

    if (error) {
        console.error("❌ Update failed:", error.message);
    } else {
        console.log("✅ Update succeeded:", data);
    }
}

pushData();
