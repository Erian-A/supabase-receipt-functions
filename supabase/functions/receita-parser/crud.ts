// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ProductPayload {
  name: unknown;
  code: unknown;
  quantity: unknown;
  unit: unknown;
  totalValue: unknown;
  purchaseDate: unknown;
  sellerName: unknown;
  publicId: unknown;
}

export async function saveProduct (authorization: string, products: ProductPayload[], protocolCode: string) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            // forward Authorization from the incoming request (if present)
            Authorization: authorization ?? "",
          },
        },
      }
    );

    // Accept either single object or array
    const items: ProductPayload[] = Array.isArray(products) ? products : [products];

    // Map to DB columns. Adjust column names if your table uses snake_case or different names.
    // Replace 'table_name' with your actual table name.
    // Example mapping assumes DB columns:
    // name, code, quantity, unit, total_value, purchase_date, seller_name
    const rowsToInsert = items.map((p) => ({
      product_name: p.name,
      product_code: p.code,
      quantity: p.quantity,
      unit: p.unit,
      total_value: p.totalValue,
      purchase_date: p.purchaseDate,
      name: p.sellerName,
      public_id: p.publicId
    }));

    // const { data, error } = await supabase.from("receipt").insert(rowsToInsert).select();
    const { data, error } = await supabase.from("receipt").upsert(rowsToInsert, { onConflict: "public_id", ignoreDuplicates: true }).select();


    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(JSON.stringify(error));
    }

  } catch (err) {
    console.error(err);
    throw new Error(JSON.stringify(err));
  }
};