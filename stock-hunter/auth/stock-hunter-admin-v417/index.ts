import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ALLOWED_ORIGIN = "https://afzalpour.github.io";
const jsonHeaders = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});

function response(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders(origin) });
}

function getAdminSecret() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("admin secret unavailable");
  const parsed = JSON.parse(raw);
  if (!parsed?.default) throw new Error("default admin secret unavailable");
  return parsed.default as string;
}

function getPublishableKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("publishable key unavailable");
  const parsed = JSON.parse(raw);
  if (!parsed?.default) throw new Error("default publishable key unavailable");
  return parsed.default as string;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    return response(origin, 403, { error: "origin_not_allowed" });
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders(origin) });
  }
  if (req.method !== "POST") {
    return response(origin, 405, { error: "method_not_allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return response(origin, 401, { error: "missing_bearer_token" });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, getPublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, getAdminSecret(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return response(origin, 401, { error: "invalid_session" });
    }
    const actorId = userData.user.id;

    const [{ data: actorRole, error: roleError }, { data: actorProfile, error: profileError }] = await Promise.all([
      admin.from("stock_hunter_user_roles_v417").select("role").eq("user_id", actorId).single(),
      admin.from("stock_hunter_profiles_v417").select("account_status").eq("user_id", actorId).single(),
    ]);
    if (roleError || profileError) {
      return response(origin, 403, { error: "admin_context_unavailable" });
    }
    if (actorProfile?.account_status !== "active") {
      return response(origin, 403, { error: "account_suspended" });
    }
    const actorRoleName = String(actorRole?.role || "user");
    if (!["owner_admin", "admin"].includes(actorRoleName)) {
      return response(origin, 403, { error: "admin_required" });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "list_users") {
      const page = Math.max(1, Math.min(100, Number(body?.page || 1)));
      const perPage = Math.max(1, Math.min(100, Number(body?.per_page || 50)));
      const { data: listed, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = listed?.users || [];
      const ids = users.map((u) => u.id);
      const [{ data: roles }, { data: profiles }] = ids.length
        ? await Promise.all([
            admin.from("stock_hunter_user_roles_v417").select("user_id,role").in("user_id", ids),
            admin.from("stock_hunter_profiles_v417").select("user_id,display_name,account_status,last_seen_at").in("user_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const safeUsers = users.map((u) => {
        const p: any = profileMap.get(u.id) || {};
        return {
          id: u.id,
          email: u.email || null,
          email_confirmed_at: u.email_confirmed_at || null,
          created_at: u.created_at || null,
          last_sign_in_at: u.last_sign_in_at || null,
          banned_until: u.banned_until || null,
          role: roleMap.get(u.id) || "user",
          display_name: p.display_name || null,
          account_status: p.account_status || "active",
          last_seen_at: p.last_seen_at || null,
        };
      });
      return response(origin, 200, { users: safeUsers, page, per_page: perPage });
    }

    if (action === "list_audit") {
      if (actorRoleName !== "owner_admin") {
        return response(origin, 403, { error: "owner_admin_required" });
      }
      const limit = Math.max(1, Math.min(200, Number(body?.limit || 50)));
      const { data, error } = await admin
        .from("stock_hunter_admin_audit_v417")
        .select("audit_id,actor_user_id,action,target_user_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return response(origin, 200, { audit: data || [] });
    }

    const targetId = String(body?.target_user_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return response(origin, 400, { error: "invalid_target_user_id" });
    }
    if (targetId === actorId && ["suspend", "set_role"].includes(action)) {
      return response(origin, 409, { error: "self_admin_mutation_forbidden" });
    }

    const { data: targetRoleRow, error: targetRoleError } = await admin
      .from("stock_hunter_user_roles_v417")
      .select("role")
      .eq("user_id", targetId)
      .single();
    if (targetRoleError) {
      return response(origin, 404, { error: "target_not_found" });
    }
    const targetRole = String(targetRoleRow?.role || "user");

    if (targetRole === "owner_admin") {
      return response(origin, 409, { error: "owner_admin_protected" });
    }

    if (action === "set_role") {
      if (actorRoleName !== "owner_admin") {
        return response(origin, 403, { error: "owner_admin_required" });
      }
      const newRole = String(body?.role || "");
      if (!["admin", "user"].includes(newRole)) {
        return response(origin, 400, { error: "invalid_role" });
      }
      const { error } = await admin
        .from("stock_hunter_user_roles_v417")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("user_id", targetId);
      if (error) throw error;
      await admin.from("stock_hunter_admin_audit_v417").insert({
        actor_user_id: actorId,
        action: "ROLE_CHANGED",
        target_user_id: targetId,
        details: { from: targetRole, to: newRole },
      });
      return response(origin, 200, { ok: true, role: newRole });
    }

    if (action === "suspend" || action === "reactivate") {
      if (actorRoleName === "admin" && targetRole !== "user") {
        return response(origin, 403, { error: "admin_cannot_manage_peer_admin" });
      }
      const suspend = action === "suspend";
      const nextStatus = suspend ? "suspended" : "active";
      const { error: authError } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: suspend ? "876000h" : "none",
      });
      if (authError) throw authError;
      const { error: statusError } = await admin
        .from("stock_hunter_profiles_v417")
        .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("user_id", targetId);
      if (statusError) throw statusError;
      await admin.from("stock_hunter_admin_audit_v417").insert({
        actor_user_id: actorId,
        action: suspend ? "USER_SUSPENDED" : "USER_REACTIVATED",
        target_user_id: targetId,
        details: { previous_role: targetRole },
      });
      return response(origin, 200, { ok: true, account_status: nextStatus });
    }

    return response(origin, 400, { error: "unknown_action" });
  } catch (error) {
    console.error("stock-hunter-admin-v417", error);
    return response(origin, 500, { error: "internal_error" });
  }
});
