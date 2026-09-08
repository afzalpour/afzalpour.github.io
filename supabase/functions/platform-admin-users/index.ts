import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'SERVER_CONFIG_MISSING' }, 500);
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'AUTH_REQUIRED' }, 401);
  }

  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);
  if (userError || !user) return json({ error: 'AUTH_REQUIRED' }, 401);

  const { data: me, error: meError } = await userClient.rpc('platform_admin_me');
  if (meError || !me?.authorized) return json({ error: 'PLATFORM_ADMIN_REQUIRED' }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'BODY_INVALID' }, 400);
  }

  const action = String(payload.action || 'list').trim();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'list') {
    const authUsers = [];
    const perPage = 200;
    for (let page = 1; page <= 25; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('platform user list auth failed', error);
        return json({ error: 'USER_LIST_FAILED' }, 500);
      }
      const batch = data?.users || [];
      authUsers.push(...batch);
      if (batch.length < perPage) break;
    }

    const [{ data: workspaces, error: workspaceError }, { data: memberships, error: membershipError }] = await Promise.all([
      admin.from('workspaces').select('id,name,owner_user_id').order('created_at', { ascending: true }),
      admin.from('workspace_members').select('user_id,workspace_id,role,is_active'),
    ]);

    if (workspaceError || membershipError) {
      console.error('platform user membership lookup failed', workspaceError || membershipError);
      return json({ error: 'USER_CONTEXT_FAILED' }, 500);
    }

    const workspaceById = new Map((workspaces || []).map((row) => [row.id, row]));
    const membershipByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const membership of memberships || []) {
      const current = membershipByUser.get(membership.user_id) || [];
      const workspace = workspaceById.get(membership.workspace_id);
      current.push({
        workspace_id: membership.workspace_id,
        workspace_name: workspace?.name || 'شرکت بدون نام',
        role: membership.role,
        is_active: Boolean(membership.is_active),
      });
      membershipByUser.set(membership.user_id, current);
    }

    const rows = authUsers
      .map((authUser) => {
        const userMemberships = membershipByUser.get(authUser.id) || [];
        const ownedCompanies = (workspaces || [])
          .filter((workspace) => workspace.owner_user_id === authUser.id)
          .map((workspace) => ({ id: workspace.id, name: workspace.name || 'شرکت بدون نام' }));
        return {
          id: authUser.id,
          email: authUser.email || '',
          created_at: authUser.created_at || null,
          last_sign_in_at: authUser.last_sign_in_at || null,
          email_confirmed_at: authUser.email_confirmed_at || null,
          is_self: authUser.id === user.id,
          memberships: userMemberships,
          owned_companies: ownedCompanies,
        };
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return json({ ok: true, users: rows });
  }

  const targetUserId = String(payload.target_user_id || '').trim();
  if (!validUuid(targetUserId)) return json({ error: 'TARGET_INVALID' }, 400);

  if (action === 'update') {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!validEmail(email)) return json({ error: 'EMAIL_INVALID' }, 400);

    const { error } = await admin.auth.admin.updateUserById(targetUserId, { email });
    if (error) {
      console.error('platform user update failed', error);
      return json({ error: 'USER_UPDATE_FAILED' }, 500);
    }

    const { error: auditError } = await userClient.rpc('platform_admin_log_user_action', {
      p_target_user_id: targetUserId,
      p_action: 'platform_user_updated',
    });
    if (auditError) console.warn('platform user update audit failed', auditError);

    return json({ ok: true });
  }

  if (action === 'delete') {
    const { data: guard, error: guardError } = await userClient.rpc('platform_admin_user_guard', {
      p_target_user_id: targetUserId,
    });
    if (guardError) {
      console.error('platform user delete guard failed', guardError);
      return json({ error: 'USER_DELETE_GUARD_FAILED' }, 500);
    }
    if (!guard?.can_delete) {
      return json({
        error: 'USER_DELETE_PROTECTED',
        is_self: Boolean(guard?.is_self),
        is_platform_admin: Boolean(guard?.is_platform_admin),
        owned_companies: Number(guard?.owned_companies || 0),
      }, 409);
    }

    const { error } = await admin.auth.admin.deleteUser(targetUserId, false);
    if (error) {
      console.error('platform user delete failed', error);
      return json({ error: 'USER_DELETE_FAILED' }, 500);
    }

    const { error: auditError } = await userClient.rpc('platform_admin_log_user_action', {
      p_target_user_id: targetUserId,
      p_action: 'platform_user_deleted',
    });
    if (auditError) console.warn('platform user delete audit failed', auditError);

    return json({ ok: true });
  }

  return json({ error: 'ACTION_INVALID' }, 400);
});