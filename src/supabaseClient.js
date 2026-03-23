import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwreletuirtrnviqlila.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cmVsZXR1aXJ0cm52aXFsaWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODU4ODMsImV4cCI6MjA4ODk2MTg4M30.JX5TnGveHtu8Tkyo33LIIzM9BgKlHr9i5-86UZB8Sfo';

// --- ON AJOUTE CECI POUR LE DEBUG ---
console.log("URL lue par l'app :", supabaseUrl);
console.log("Clé lue par l'app :", supabaseKey.substring(0, 20) + "..."); 
// ------------------------------------

export const supabase = createClient(supabaseUrl, supabaseKey);