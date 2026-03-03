import { createClient } from '@supabase/supabase-js';

// Explicitly using the credentials provided by the user to ensure stability
const supabaseUrl = 'https://wdmixpockvsrvkfuxjls.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbWl4cG9ja3ZzcnZrZnV4amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODkzNjcsImV4cCI6MjA4ODA2NTM2N30.ymsRiY3T-JxQwCNs9N7JiekbO0AQ27MtQMIbWe14kCI';

// Validation: Supabase Anon Keys should be JWTs (start with eyJ)
if (supabaseAnonKey && !supabaseAnonKey.startsWith('eyJ')) {
  console.warn('AVISO: A chave fornecida não parece ser válida.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'photo-gallery-app' },
  },
});
