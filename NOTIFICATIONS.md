# ShotFlow Email Notifications

This document describes how to set up and configure email notifications for ShotFlow.

## Overview

ShotFlow can send email notifications when new versions are uploaded to shots. Users can subscribe to specific projects or all projects to receive these alerts.

## Architecture

```
┌─────────────────┐     INSERT     ┌─────────────────┐
│    versions     │───────────────▶│  DB Trigger     │
│    table        │                │  (pg_net)       │
└─────────────────┘                └────────┬────────┘
                                            │
                                            ▼ HTTP POST
                              ┌─────────────────────────┐
                              │  Supabase Edge Function │
                              │  notify-version-upload  │
                              └────────────┬────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │     Resend API          │
                              │     (Email Service)     │
                              └─────────────────────────┘
```

## Setup Instructions

### 1. Get a Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Create an API key with send permissions
3. (Optional) Verify your domain for custom "from" addresses

### 2. Configure Supabase Secrets

Add the Resend API key to your Supabase project:

```bash
# Via Supabase CLI
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx

# Or via Dashboard:
# Project Settings → Edge Functions → Secrets
```

Also set the app URL for review links:

```bash
supabase secrets set APP_URL=https://your-shotflow-domain.com
```

### 3. Deploy the Edge Function

```bash
cd shotflow

# Link to your Supabase project (if not already linked)
supabase link --project-ref xwvqcloimcstevsmlbfb

# Deploy the function
supabase functions deploy notify-version-upload
```

### 4. Apply Database Migrations

Apply the migrations to create the subscriptions table and trigger:

```bash
# Via Supabase CLI
supabase db push

# Or via Dashboard:
# SQL Editor → Run the contents of:
#   - supabase/migrations/20260227_notification_subscriptions.sql
#   - supabase/migrations/20260227_version_upload_webhook.sql
```

### 5. Configure Database Settings (for trigger)

The trigger needs access to the service role key. Set it via Dashboard:

1. Go to **Project Settings → Database → Database Settings**
2. Under "Connection pooling" or "App settings", add:
   - `app.settings.service_role_key` = your service role key
   - `app.settings.supabase_url` = your project URL

Or run this SQL:

```sql
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xwvqcloimcstevsmlbfb.supabase.co';
```

## User Guide

### Subscribing to Notifications

1. Go to **Settings** in ShotFlow
2. In the **Email Notifications** section:
   - Select a project from the dropdown (or "All Projects")
   - Click **Subscribe**
3. Your subscriptions appear below with toggles to enable/disable

### What Gets Notified

- **Version Uploads**: When any user uploads a new version to a shot
  - You won't receive notifications for your own uploads
  - Email includes: project name, shot code, version number, uploader, review link

## Email Template

Notification emails include:

- Project name and code
- Shot code (sequence_shot format)
- Version number (v001 format)
- Who uploaded the version
- Direct link to review the version

## Troubleshooting

### Emails not sending

1. **Check Resend API key**: Verify it's set correctly in Supabase secrets
2. **Check Edge Function logs**: Dashboard → Edge Functions → notify-version-upload → Logs
3. **Check trigger is active**: Run `SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_version_upload';`
4. **Test the function manually**:
   ```bash
   curl -X POST 'https://xwvqcloimcstevsmlbfb.supabase.co/functions/v1/notify-version-upload' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"type":"INSERT","table":"versions","record":{"id":"test","shot_id":"...","version_number":1,"created_by_id":"..."}}'
   ```

### Subscriptions not saving

1. Check RLS policies are applied
2. Verify user is authenticated
3. Check browser console for errors

## Development

### Testing Locally

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve notify-version-upload --env-file .env.local
```

### Environment Variables

Create `.env.local` for local testing:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
APP_URL=http://localhost:3000
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
```

## Security Notes

- Subscriptions use Row Level Security (RLS) - users can only manage their own
- The Edge Function runs with service role permissions for cross-user queries
- Emails are sent via Resend's API (no SMTP credentials stored)
- The database trigger uses `SECURITY DEFINER` to call pg_net
