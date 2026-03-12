import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const SUPABASE_URL = 'https://bxhlqokfbgbdvpypuqrk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aGxxb2tmYmdiZHZweXB1cXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTYyODgsImV4cCI6MjA4ODgzMjI4OH0.ovVBIr57TDsNEkiZEWh7q4FWa0IL_Bp9cXR-npISUKA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const schedulePath = './src/data/schedule.json';
const scheduleData = JSON.parse(readFileSync(schedulePath, 'utf-8'));

async function seed() {
    const { data, error } = await supabase
        .from('global_schedule')
        .upsert({ id: 1, schedule_data: scheduleData, updated_at: new Date() }, { onConflict: 'id' })
        .select();

    if (error) {
        console.error("❌ Failed to seed:", error.message);
    } else {
        console.log("✅ Seeded DB successfully! Rows returned:", data?.length);
    }
}

seed();
