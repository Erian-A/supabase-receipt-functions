import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 500;
const DEFAULT_ORDER_BY = "id"; // change if your PK is different

function parseNumberParam(val: string | null, fallback: number) {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const mode = (params.get("mode") || "cursor").toLowerCase(); // "cursor" or "offset"
    const pageSizeRaw = parseNumberParam(params.get("pageSize"), DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
    const page = parseNumberParam(params.get("page"), 1);
    const cursor = params.get("cursor"); // for cursor mode
    const orderBy = params.get("orderBy") || DEFAULT_ORDER_BY;
    const orderDir = (params.get("orderDir") || "asc").toLowerCase() === "desc" ? "desc" : "asc";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      }
    );

    if (mode === "offset") {
      // offset-based pagination
      const offset = (page - 1) * pageSize;
      const { data, error, count } = await supabase
        .from("receipt")
        .select("*", { count: "exact" })
        .order(orderBy, { ascending: orderDir === "asc" })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const hasMore = typeof count === "number" ? offset + data.length < count : data.length === pageSize;

      return new Response(
        JSON.stringify({
          data,
          meta: {
            mode: "offset",
            page,
            pageSize,
            count,
            hasMore,
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // cursor-based pagination (recommended)
      // Requires orderBy to be a column with unique or stable ordering (e.g., created_at + id)
      // We fetch pageSize + 1 to detect whether there's a next page.
      const op = orderDir === "asc" ? "gt" : "lt"; // for cursor: greater than (asc), less than (desc)
      let query = supabase
        .from("receipt")
        .select("*")
        .order(orderBy, { ascending: orderDir === "asc" })
        .limit(pageSize + 1);

      if (cursor) {
        // If cursor provided, filter
        // Use rpc-style filter: .gt(orderBy, cursor) / .lt(orderBy, cursor)
        // However supabase-js uses filter methods like .gt(column, value)
        // We'll apply a filter accordingly:
        // @ts-ignore - supabase-js typings for dynamic filters
        query = (query as any)[op](orderBy, cursor);
      }

      const { data, error } = await query;

      if (error) throw error;

      let rows = data || [];
      let hasMore = false;
      let nextCursor: string | null = null;

      if (rows.length > pageSize) {
        hasMore = true;
        const nextItem = rows[pageSize];
        rows = rows.slice(0, pageSize);
        // next cursor is the ordering column value of nextItem
        nextCursor = String(nextItem?.[orderBy]);
      }

      return new Response(
        JSON.stringify({
          data: rows,
          meta: {
            mode: "cursor",
            pageSize,
            nextCursor,
            hasMore,
            orderBy,
            orderDir,
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }
  } catch (err) {
    console.error("Pagination error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});