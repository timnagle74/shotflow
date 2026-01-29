/**
 * Coconut.co video transcoding integration
 * https://docs.coconut.co/
 */

const COCONUT_API_KEY = process.env.COCONUT_API_KEY;
const COCONUT_API_URL = 'https://api.coconut.co/v2/jobs';

export interface CoconutJobResponse {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  progress: string;
  outputs?: Array<{
    key: string;
    type: string;
    format: string;
    status: string;
    url?: string;
  }>;
}

/**
 * Check if Coconut is configured
 */
export function isCoconutConfigured(): boolean {
  return !!COCONUT_API_KEY;
}

/**
 * Create a transcoding job that outputs to Bunny Storage
 * The transcoded file can then be fetched by Bunny Stream
 */
export async function createTranscodeJob(
  sourceUrl: string,
  outputPath: string,
  bunnyStorageZone: string,
  bunnyStoragePassword: string,
  webhookUrl?: string
): Promise<CoconutJobResponse> {
  if (!COCONUT_API_KEY) {
    throw new Error('Coconut API key not configured');
  }

  const job: Record<string, any> = {
    input: {
      url: sourceUrl,
    },
    storage: {
      service: 's3other',
      endpoint: 'https://storage.bunnycdn.com',
      bucket: bunnyStorageZone,
      credentials: {
        access_key_id: bunnyStorageZone,
        secret_access_key: bunnyStoragePassword,
      },
    },
    outputs: {
      'mp4:1080p': {
        path: outputPath,
      },
    },
  };

  if (webhookUrl) {
    job.notification = {
      type: 'http',
      url: webhookUrl,
    };
  }

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
