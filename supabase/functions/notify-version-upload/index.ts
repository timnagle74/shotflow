// Supabase Edge Function: notify-version-upload
// Triggered via database webhook on INSERT to versions table
// Queues notifications for batched digest emails (sent every 5 minutes)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface VersionPayload {
  type: 'INSERT'
  table: 'versions'
  record: {
    id: string
    shot_id: string
    version_number: number
    created_by_id: string
    status: string
    description: string | null
    created_at: string
  }
  schema: 'public'
  old_record: null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const payload: VersionPayload = await req.json()

    // Only process INSERT events
    if (payload.type !== 'INSERT' || payload.table !== 'versions') {
      return new Response(JSON.stringify({ message: 'Ignored: not a version insert' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const version = payload.record
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get shot → sequence → project chain
    const { data: shot, error: shotError } = await supabase
      .from('shots')
      .select(`
        id,
        code,
        sequence:sequences!inner(
          id,
          name,
          code,
          project:projects!inner(
            id,
            name,
            code
          )
        )
      `)
      .eq('id', version.shot_id)
      .single()

    if (shotError || !shot) {
      console.error('Failed to fetch shot details:', shotError)
      return new Response(JSON.stringify({ error: 'Shot not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const project = shot.sequence.project
    const projectId = project.id

    // Find all subscribers for this project
    // Include users subscribed to this specific project OR subscribed to all projects (project_id IS NULL)
    const { data: subscriptions, error: subError } = await supabase
      .from('notification_subscriptions')
      .select(`
        id,
        user_id,
        notify_on_version_upload,
        user:users!inner(
          id,
          name,
          email
        )
      `)
      .eq('notify_on_version_upload', true)
      .or(`project_id.eq.${projectId},project_id.is.null`)

    if (subError) {
      console.error('Failed to fetch subscriptions:', subError)
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscribers for this project' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Don't notify the uploader about their own upload
    const recipients = subscriptions
      .filter(sub => sub.user.id !== version.created_by_id)
      .map(sub => sub.user)

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients after filtering' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Queue notifications for each recipient
    const pendingNotifications = recipients.map(user => ({
      user_id: user.id,
      project_id: projectId,
      shot_id: shot.id,
      version_id: version.id,
      version_number: version.version_number,
      created_by_id: version.created_by_id,
    }))

    const { error: insertError, count } = await supabase
      .from('pending_notifications')
      .insert(pendingNotifications)

    if (insertError) {
      console.error('Failed to queue notifications:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to queue notifications' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Queued ${recipients.length} notifications for ${project.code}/${shot.code} v${version.version_number}`)

    return new Response(JSON.stringify({
      success: true,
      queued: recipients.length,
      project: project.code,
      shot: shot.code,
      version: version.version_number,
      message: 'Notifications queued for digest email',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
