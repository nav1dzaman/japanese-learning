import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// ⚠️  Replace these with your actual Supabase project values
// URL: https://app.supabase.com → Project Settings → API
const SUPABASE_URL = 'https://fapcgeyzgerkfbnehkif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcGNnZXl6Z2Vya2ZibmVoa2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDk5NDEsImV4cCI6MjA5NTI4NTk0MX0.LSZonbjnDvaSs8-L7hIXMCYbYLlnB1KAQcoAZqwd9ds';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
