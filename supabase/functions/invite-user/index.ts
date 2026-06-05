import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { email } = await req.json() as { email: string };
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: corsHeaders });
    }

    // Insert invitation record
    await supabaseAdmin.from("invitations").upsert({
      email: email.toLowerCase(),
      invited_by: user.id,
      created_at: Date.now(),
    });

    // Send Supabase Auth invite email
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw inviteError;

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
