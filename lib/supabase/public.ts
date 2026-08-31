import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Anonymous Supabase client for public, cacheable pages. Anon key, RLS
 * applies, and — the whole point — no cookie adapter.
 *
 * `createClient()` in ./server.ts calls `cookies()`, and reading cookies opts
 * a route into dynamic rendering for every request. That is correct for any
 * screen whose output depends on who is looking, but the public blog's output
 * does not: both blog pages pin `status = 'published'`, so an author or admin
 * sees exactly what an anonymous visitor sees. Paying a Supabase round trip on
 * every request for a page that renders identically for everyone is pure cost.
 *
 * Use this ONLY where the rendered output genuinely does not depend on the
 * session, because anything built on it can be cached and served to everyone.
 * If a page ever needs to branch on the viewer, it needs ./server.ts and it
 * cannot be statically cached — those two facts are the same fact.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
