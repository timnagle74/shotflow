// Supabase Edge Function: notify-version-upload
// Triggered via database webhook on INSERT to versions table
// Sends email notifications to subscribed users via Resend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://shotflow.app'

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

interface EmailPayload {
  from: string
  to: string[]
  subject: string
  html: string
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
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

    // Get the uploader's name
    const { data: uploader } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', version.created_by_id)
      .single()

    const uploaderName = uploader?.name || uploader?.email || 'Unknown'

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
    const recipientEmails = subscriptions
      .filter(sub => sub.user.id !== version.created_by_id)
      .map(sub => sub.user.email)
      .filter((email): email is string => !!email)

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients after filtering' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build email content
    const shotCode = shot.code
    const sequenceCode = shot.sequence.code
    const fullShotCode = `${sequenceCode}_${shotCode}`
    const reviewLink = `${APP_URL}/projects/${projectId}/shots/${shot.id}?version=${version.id}`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 20px; }
          .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
          .info-row { margin-bottom: 12px; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .value { font-size: 16px; font-weight: 500; color: #111827; }
          .button { display: inline-block; background: #6366f1; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 16px; }
          .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 New Version Uploaded</h1>
          </div>
          <div class="content">
            <div class="info-row">
              <div class="label">Project</div>
              <div class="value">${project.name} (${project.code})</div>
            </div>
            <div class="info-row">
              <div class="label">Shot</div>
              <div class="value">${fullShotCode}</div>
            </div>
            <div class="info-row">
              <div class="label">Version</div>
              <div class="value">v${String(version.version_number).padStart(3, '0')}</div>
            </div>
            <div class="info-row">
              <div class="label">Uploaded by</div>
              <div class="value">${uploaderName}</div>
            </div>
            ${version.description ? `
            <div class="info-row">
              <div class="label">Notes</div>
              <div class="value">${version.description}</div>
            </div>
            ` : ''}
            <a href="${reviewLink}" class="button">Review Version →</a>
          </div>
          <div class="footer">
            <p>You're receiving this because you subscribed to updates for ${project.name}.</p>
            <p>Manage your notification preferences in ShotFlow settings.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send emails (batch to Resend supports up to 100 recipients)
    const emailSent = await sendEmail({
      from: 'ShotFlow <notifications@shotflow.app>',
      to: recipientEmails,
      subject: `[${project.code}] New version: ${fullShotCode} v${String(version.version_number).padStart(3, '0')}`,
      html: emailHtml,
    })

    return new Response(JSON.stringify({
      success: emailSent,
      recipientCount: recipientEmails.length,
      project: project.code,
      shot: fullShotCode,
      version: version.version_number,
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
