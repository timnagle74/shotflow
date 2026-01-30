/**
 * Coconut.co video transcoding integration
 * https://docs.coconut.co/
 */

const COCONUT_API_KEY = process.env.COCONUT_API_KEY;
const COCONUT_API_URL = 'https://api.coconut.co/v2/jobs';

// Bunny Storage for transcoded outputs
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;

export interface CoconutOutput {
  key: string;
  type: string;
  format: string;
  status: string;
  url?: string;
  error?: string;
}

export interface CoconutJobResponse {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  progress: string;
  input: {
    status: string;
    error?: string;
  };
  outputs: CoconutOutput[];
}

/**
 * Check if Coconut is configured
 */
export function isCoconutConfigured(): boolean {
  const configured = !!COCONUT_API_KEY && !!BUNNY_STORAGE_ZONE && !!BUNNY_STORAGE_PASSWORD;
  console.log('isCoconutConfigured:', {
    configured,
    hasApiKey: !!COCONUT_API_KEY,
    hasStorageZone: !!BUNNY_STORAGE_ZONE,
    hasStoragePassword: !!BUNNY_STORAGE_PASSWORD,
  });
  return configured;
}

/**
 * Create a transcoding job that outputs to Bunny Storage via FTP
 * The webhook will receive notification when complete
 */
export async function createTranscodeJob(
  sourceUrl: string,
  outputPath: string,
  webhookUrl: string
): Promise<CoconutJobResponse> {
  if (!COCONUT_API_KEY) {
    throw new Error('Coconut API key not configured');
  }
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_PASSWORD) {
    throw new Error('Bunny Storage not configured for Coconut output');
  }

  const job = {
    input: {
      url: sourceUrl,
    },
    storage: {
      // Output to Bunny Storage via FTP
      url: `ftp://${BUNNY_STORAGE_ZONE}:${BUNNY_STORAGE_PASSWORD}@storage.bunnycdn.com/transcoded`,
    },
    notification: {
      type: 'http',
      url: webhookUrl,
    },
    outputs: {
      'mp4:1080p': {
        path: outputPath,
      },
    },
  };

  // Coconut uses HTTP Basic Auth with API key as username
  const authString = Buffer.from(`${COCONUT_API_KEY}:`).toString('base64');

  const response = await fetch(COCONUT_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Coconut API error:', errorData);
    throw new Error(`Coconut API error: ${errorData.message || response.status}`);
  }

  return response.json();
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<CoconutJobResponse> {
  if (!COCONUT_API_KEY) {
    throw new Error('Coconut API key not configured');
  }

  const authString = Buffer.from(`${COCONUT_API_KEY}:`).toString('base64');

  const response = await fetch(`${COCONUT_API_URL}/${jobId}`, {
    headers: {
      'Authorization': `Basic ${authString}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Coconut API error: ${response.status}`);
  }

  return response.json();
}
