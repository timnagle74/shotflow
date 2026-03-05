-- Database webhook trigger for version upload notifications
-- Note: This creates a pg_net HTTP request to the edge function
-- Requires pg_net extension enabled in Supabase

-- Create function to call the edge function via HTTP
CREATE OR REPLACE FUNCTION notify_version_upload()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  supabase_url text;
  service_key text;
BEGIN
  -- Build the webhook payload matching Supabase webhook format
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'versions',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'shot_id', NEW.shot_id,
      'version_number', NEW.version_number,
      'created_by_id', NEW.created_by_id,
      'status', NEW.status,
      'description', NEW.description,
      'created_at', NEW.created_at
    ),
    'old_record', null
  );

  -- Get Supabase URL from app settings (set via Dashboard > Project Settings > Database > App Settings)
  -- Or use the hardcoded project URL
  supabase_url := coalesce(
    current_setting('app.settings.supabase_url', true),
    'https://xwvqcloimcstevsmlbfb.supabase.co'
  );
  
  -- Make async HTTP request to edge function
  -- Using pg_net extension for non-blocking HTTP calls
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-version-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'notify_version_upload failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on versions table
DROP TRIGGER IF EXISTS trigger_notify_version_upload ON versions;
CREATE TRIGGER trigger_notify_version_upload
  AFTER INSERT ON versions
  FOR EACH ROW
  EXECUTE FUNCTION notify_version_upload();

COMMENT ON FUNCTION notify_version_upload() IS 'Triggers email notifications when new versions are uploaded';
