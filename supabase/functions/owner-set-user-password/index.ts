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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return json({ error: 'AUTH_REQUIRED' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'BODY_INVALID' }, 400);
  }

  const workspaceId = String(payload.workspace_id || '').trim();
  const targetUserId = String(payload.target_user_id || '').trim();
  const newPassword = String(payload.new_password || '');

  if (!workspaceId || !targetUserId) {
    return json({ error: 'TARGET_REQUIRED' }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: 'PASSWORD_TOO_SHORT' }, 400);
  }
  if (newPassword.length > 128) {
    return json({ error: 'PASSWORD_TOO_LONG' }, 400);
  }
  if (targetUserId === user.id) {
    return json({ error: 'SELF_PASSWORD_CHANGE_FORBIDDEN' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: actor, error: actorError } = await admin
    .from('workspace_members')
    .select('role,is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (actorError) {
    console.error('owner password actor lookup failed', actorError);
    return json({ error: 'ACCESS_LOOKUP_FAILED' }, 500);
  }
  if (!actor?.is_active || actor.role !== 'owner') {
    return json({ error: 'FORBIDDEN' }, 403);
  }

  const { data: target, error: targetError } = await admin
    .from('workspace_members')
    .select('role,is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (targetError) {
    console.error('owner password target lookup failed', targetError);
    return json({ error: 'ACCESS_LOOKUP_FAILED' }, 500);
  }
  if (!target?.is_active) {
    return json({ error: 'TARGET_NOT_MEMBER' }, 404);
  }
  if (target.role === 'owner') {
    return json({ error: 'TARGET_OWNER_PROTECTED' }, 403);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    targetUserId,
    { password: newPassword },
  );

  if (updateError) {
    console.error('owner password auth update failed', updateError);
    return json({ error: 'PASSWORD_UPDATE_FAILED' }, 500);
  }

  const { error: auditError } = await admin
    .from('audit_logs')
    .insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      action: 'owner_password_reset',
      entity_type: 'auth_user',
      entity_id: targetUserId,
      summary: 'Workspace owner changed a member password',
    });

  if (auditError) {
    console.warn('owner password audit insert failed', auditError);
  }

  return json({ ok: true });
});
