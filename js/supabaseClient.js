// ⚠️ Substitua pelos dados do SEU projeto no Supabase
// Você encontra esses valores em: Project Settings > API
const SUPABASE_URL = "https://clvfmwolqxjwhejbzdxa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_61vgjYFSgEhkmqVUHaczOQ_OlG_F8TG";

// Cria o cliente que será usado em todas as páginas
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
