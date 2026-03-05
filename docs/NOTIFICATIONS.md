# ShotFlow Email Notifications

**Built:** March 5, 2026

## Overview

Email notification system that alerts subscribed users when new versions are uploaded to shots they care about. Includes batching to avoid email spam when multiple versions are uploaded in quick succession.

## How It Works

```
User uploads version → Trigger fires → Queued to pending_notifications
                                              ↓
                              Every 5 min: Cron job runs
                                              ↓
                              Digest email sent (grouped by project)
                                              ↓
                              Click link → Login (if needed) → Shot page
```

## Components

### 1. Database Tables

**`notification_subscriptions`**
- `user_id` - Who wants notifications
- `project_id` - Which project (NULL = all projects)
- `notify_on_version_upload` - Toggle on/off

**`pending_notifications`**
- Queues notifications until the digest runs
- Stores version details for email content
- Cleared after digest sends

### 2. Edge Functions

**`notify-version-upload`**
- Triggered by database trigger on `versions` INSERT
- Looks up subscribers for the project
- Inserts into `pending_notifications` queue
- Does NOT send email directly

**`send-notification-digest`**
- Called every 5 minutes by pg_cron
- Groups pending notifications by user, then by project
- Sends one digest email per user
- Deletes processed notifications

### 3. Database Trigger

```sql
trigger_notify_version_upload ON versions
  AFTER INSERT → calls notify_version_upload() 
  → uses pg_net to POST to edge function
```

### 4. Cron Job (pg_cron)

```sql
*/5 * * * * → call_notification_digest() → POST to send-notification-digest
```

## Configuration

### Supabase Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set RESEND_FROM_EMAIL=shotflow@creativeintegrations.io
supabase secrets set APP_URL=https://shotflow-eight.vercel.app
```

### Required Extensions

- `pg_net` - For HTTP calls from triggers
- `pg_cron` - For scheduled digest runs

## Email Format

**Subject:** `[ShotFlow] 3 new versions in Project X (and 1 more project)`

**Body:**
- Grouped by project
- Table with shot code, version number, uploader
- Links to each shot's review page
- "Open ShotFlow" button

**From:** `ShotFlow <shotflow@creativeintegrations.io>`

## User Flow

### Subscribing
1. Go to ShotFlow → Settings
2. Click "Add Subscription"
3. Select project (or "All Projects")
4. Toggle notifications on

### Receiving Notifications
1. Someone uploads a version to a subscribed project
2. Wait up to 5 minutes for digest
3. Email arrives with all new versions
4. Click shot link → Login if needed → Lands on shot page

## Files

```
shotflow/
├── supabase/
│   ├── functions/
│   │   ├── notify-version-upload/index.ts    # Queue notifications
│   │   └── send-notification-digest/index.ts # Send batched emails
│   └── migrations/
│       ├── 20260227_notification_subscriptions.sql
│       └── 20260305_notification_batching.sql
└── src/
    ├── middleware.ts           # Preserves redirectTo for login
    ├── app/login/page.tsx      # Handles redirectTo after auth
    └── app/auth/callback/route.ts # OAuth redirect handling
```

## Testing

```bash
# Create test version (triggers queue)
# Use Supabase JS client to insert into versions table

# Manually trigger digest (don't wait for cron)
curl -X POST "https://xwvqcloimcstevsmlbfb.supabase.co/functions/v1/send-notification-digest" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

### No email received
1. Check `pending_notifications` table - is notification queued?
2. Check `net._http_response` - did edge function return success?
3. Check Resend dashboard for delivery status
4. Verify domain is verified in Resend

### Wrong URL in email
- Update `APP_URL` in Supabase secrets
- Redeploy edge functions not needed (reads from env)

### Dropped to dashboard after login
- Fixed in commit `0d6037b` - middleware now preserves `redirectTo` param

## Known Limitations

- **Deep link after OAuth:** When clicking email link → Google login, user lands on dashboard instead of the specific shot. They can navigate from there. (Email/password login preserves the redirect correctly.)

## Future Improvements

- [ ] Fix deep linking after Google OAuth
- [ ] Notification preferences UI in settings
- [ ] Email preference for immediate vs digest
- [ ] Slack/Discord webhook option
- [ ] Unsubscribe link in email footer
