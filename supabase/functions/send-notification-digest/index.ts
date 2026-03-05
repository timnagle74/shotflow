// Supabase Edge Function: send-notification-digest
// Called every 5 minutes by pg_cron to send batched notification emails
// Groups notifications by user, then by project, and sends a single digest email

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://shotflow.app'
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@creativeintegrations.io'

interface PendingNotification {
  id: string
  user_id: string
  project_id: string
  shot_id: string
  version_id: string
  version_number: number
  created_by_id: string
  created_at: string
}

interface ProjectInfo {
  id: string
  name: string
  code: string
}

interface ShotInfo {
  id: string
  code: string
  sequence: {
    code: string
  }
}

interface UserInfo {
  id: string
  name: string | null
  email: string
}

interface EmailPayload {
  from: string
  to: string
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

function formatVersionNumber(num: number): string {
  return `v${String(num).padStart(3, '0')}`
}

function buildDigestEmail(
  userName: string,
  projectGroups: Map<string, {
    project: ProjectInfo
    versions: Array<{
      shot: ShotInfo
      versionNumber: number
      versionId: string
      uploaderName: string
    }>
  }>
): { subject: string; html: string } {
  const projectCount = projectGroups.size
  const totalVersions = Array.from(projectGroups.values()).reduce(
    (sum, group) => sum + group.versions.length, 0
  )

  // Build subject line
  const firstProject = Array.from(projectGroups.values())[0]
  let subject = `[ShotFlow] ${totalVersions} new version${totalVersions > 1 ? 's' : ''} in ${firstProject.project.name}`
  if (projectCount > 1) {
    subject += ` (and ${projectCount - 1} more project${projectCount > 1 ? 's' : ''})`
  }

  // Build HTML body
  let projectsHtml = ''
  for (const [projectId, group] of projectGroups) {
    const versionsHtml = group.versions.map(v => {
      const fullShotCode = `${v.shot.sequence.code}_${v.shot.code}`
      const reviewLink = `${APP_URL}/shots/${v.shot.id}?version=${v.versionId}`
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <a href="${reviewLink}" style="color: #6366f1; text-decoration: none; font-weight: 500;">${fullShotCode}</a>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            ${formatVersionNumber(v.versionNumber)}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
            ${v.uploaderName}
          </td>
        </tr>
      `
    }).join('')

    projectsHtml += `
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">
          📁 ${group.project.name} <span style="color: #6b7280; font-weight: normal;">(${group.project.code})</span>
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Shot</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Version</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Uploaded by</th>
            </tr>
          </thead>
          <tbody>
            ${versionsHtml}
          </tbody>
        </table>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      </style>
    </head>
    <body style="background: #f3f4f6; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🎬 Version Upload Digest</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">
            ${totalVersions} new version${totalVersions > 1 ? 's' : ''} across ${projectCount} project${projectCount > 1 ? 's' : ''}
          </p>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px 0; color: #374151;">Hi ${userName || 'there'},</p>
          <p style="margin: 0 0 20px 0; color: #374151;">Here's a summary of recent version uploads you're subscribed to:</p>
          ${projectsHtml}
          <a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 8px;">Open ShotFlow →</a>
        </div>
        <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
          <p>You're receiving this because you subscribed to version upload notifications.</p>
          <p>Manage your notification preferences in ShotFlow settings.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return { subject, html }
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

  const startTime = Date.now()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Fetch all pending notifications
    const { data: pending, error: fetchError } = await supabase
      .from('pending_notifications')
      .select('*')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch pending notifications:', fetchError)
      return new Response(JSON.stringify({ error: 'Failed to fetch pending notifications' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No pending notifications',
        processed: 0,
        duration: Date.now() - startTime,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing ${pending.length} pending notifications`)

    // Get unique IDs for batch lookups
    const userIds = [...new Set(pending.map(p => p.user_id))]
    const projectIds = [...new Set(pending.map(p => p.project_id))]
    const shotIds = [...new Set(pending.map(p => p.shot_id))]
    const uploaderIds = [...new Set(pending.map(p => p.created_by_id))]

    // Batch fetch all related data
    const [usersResult, projectsResult, shotsResult, uploadersResult] = await Promise.all([
      supabase.from('users').select('id, name, email').in('id', userIds),
      supabase.from('projects').select('id, name, code').in('id', projectIds),
      supabase.from('shots').select('id, code, sequence:sequences!inner(code)').in('id', shotIds),
      supabase.from('users').select('id, name, email').in('id', uploaderIds),
    ])

    if (usersResult.error || projectsResult.error || shotsResult.error || uploadersResult.error) {
      console.error('Failed to fetch related data:', { 
        usersError: usersResult.error, 
        projectsError: projectsResult.error,
        shotsError: shotsResult.error,
        uploadersError: uploadersResult.error,
      })
      return new Response(JSON.stringify({ error: 'Failed to fetch related data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create lookup maps
    const usersMap = new Map(usersResult.data!.map(u => [u.id, u as UserInfo]))
    const projectsMap = new Map(projectsResult.data!.map(p => [p.id, p as ProjectInfo]))
    const shotsMap = new Map(shotsResult.data!.map(s => [s.id, s as ShotInfo]))
    const uploadersMap = new Map(uploadersResult.data!.map(u => [u.id, u as UserInfo]))

    // Group notifications by user
    const userGroups = new Map<string, PendingNotification[]>()
    for (const notification of pending) {
      const existing = userGroups.get(notification.user_id) || []
      existing.push(notification)
      userGroups.set(notification.user_id, existing)
    }

    // Process each user's notifications
    const results: Array<{ userId: string; email: string; success: boolean; versionCount: number }> = []
    const processedIds: string[] = []

    for (const [userId, notifications] of userGroups) {
      const user = usersMap.get(userId)
      if (!user?.email) {
        console.warn(`User ${userId} has no email, skipping`)
        // Still mark as processed to avoid re-processing
        processedIds.push(...notifications.map(n => n.id))
        continue
      }

      // Group by project
      const projectGroups = new Map<string, {
        project: ProjectInfo
        versions: Array<{
          shot: ShotInfo
          versionNumber: number
          versionId: string
          uploaderName: string
        }>
      }>()

      for (const notification of notifications) {
        const project = projectsMap.get(notification.project_id)
        const shot = shotsMap.get(notification.shot_id)
        const uploader = uploadersMap.get(notification.created_by_id)

        if (!project || !shot) {
          console.warn(`Missing project or shot for notification ${notification.id}`)
          processedIds.push(notification.id)
          continue
        }

        if (!projectGroups.has(notification.project_id)) {
          projectGroups.set(notification.project_id, {
            project,
            versions: [],
          })
        }

        projectGroups.get(notification.project_id)!.versions.push({
          shot,
          versionNumber: notification.version_number,
          versionId: notification.version_id,
          uploaderName: uploader?.name || uploader?.email || 'Unknown',
        })
      }

      if (projectGroups.size === 0) {
        processedIds.push(...notifications.map(n => n.id))
        continue
      }

      // Build and send digest email
      const { subject, html } = buildDigestEmail(user.name || '', projectGroups)

      const success = await sendEmail({
        from: `ShotFlow <${RESEND_FROM_EMAIL}>`,
        to: user.email,
        subject,
        html,
      })

      results.push({
        userId,
        email: user.email,
        success,
        versionCount: notifications.length,
      })

      // Mark as processed regardless of email success (to prevent infinite retries)
      processedIds.push(...notifications.map(n => n.id))
    }

    // Delete processed notifications
    if (processedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('pending_notifications')
        .delete()
        .in('id', processedIds)

      if (deleteError) {
        console.error('Failed to delete processed notifications:', deleteError)
        // Don't fail the whole operation - notifications were sent
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`Digest complete: ${successCount} emails sent, ${failCount} failed, ${processedIds.length} notifications processed`)

    return new Response(JSON.stringify({
      success: true,
      emailsSent: successCount,
      emailsFailed: failCount,
      notificationsProcessed: processedIds.length,
      duration: Date.now() - startTime,
      details: results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error processing digest:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
