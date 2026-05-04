import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const result = await requireAdmin(req.headers);
    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          isAdmin: false,
          error: result.error,
          user: result.user ?? null,
        },
        { status: result.status },
      );
    }

    return jsonResponse({
      ok: true,
      isAdmin: true,
      user: result.user,
      role: result.admin.role,
    });
  } catch (error) {
    console.error("admin-session failed", error);
    return jsonResponse(
      { ok: false, isAdmin: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
});

