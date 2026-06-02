import { createClient } from "npm:@supabase/supabase-js@2.35.0";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  // Only allow GET for health-check
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  // Create Supabase client using service role key for DB access
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ status: 'unhealthy', message: 'Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
  });

  // Basic quick DB check: simple SELECT 1
  try {
    const ping = await sb.rpc('pg_sleep', { _p1: 0 }).rpc; // attempt something safe
  } catch (e) {
    // ignore, we'll do a real query below and catch errors
  }

  try {
    const { data, error, status } = await sb
      .from('receipt')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ status: 'unhealthy', message: 'Database query failed', details: error.message }), { status: 502, headers: corsHeaders });
    }

    if (!data) {
      return new Response(JSON.stringify({ status: 'healthy', message: 'No receipts found', latest: null }), { status: 200, headers: corsHeaders });
    }

    // Ensure created_at is ISO string
    const createdAt = data.created_at ? new Date(data.created_at).toISOString() : null;

    return new Response(JSON.stringify({ status: 'healthy', latest: { ...data, created_at: createdAt } }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Edge function error', details: String(err) }), { status: 500, headers: corsHeaders });
  }
});
