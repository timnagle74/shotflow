/**
 * Coconut.co video transcoding integration
 * https://docs.coconut.co/
 */

const COCONUT_API_KEY = process.env.COCONUT_API_KEY;
const COCONUT_API_URL = 'https://api.coconut.co/v2/jobs';

export interface CoconutJobInput {
  url: string;
}

export interface CoconutJobOutput {
  key: string;
  format: string;
  url?: string; // For httpstream output
  credentials?: {
    access_key?: string;
  };
}

export interface CoconutJob {
  input: CoconutJobInput;
  outputs: Record<string, any>;
  webhook?: string;
}

export interface CoconutJobResponse {
  id: string;
  status: string;
  created_at: string;
  outputs?: Record<string, any>;
}

/**
 * Check if Coconut is configured
 */
export function isCoconutConfigured(): boolean {
  return !!COCONUT_API_KEY;
}

/**
 * Create a transcoding job
 * Takes a source video URL and outputs H.264 1080p to the specified destination
 */
export async function createTranscodeJob(
  sourceUrl: string,
  outputUrl: string,
  outputAccessKey: string,
  webhookUrl?: string
): Promise<CoconutJobResponse> {
  if (!COCONUT_API_KEY) {
    throw new Error('Coconut API key not configured');
  }

  const job: CoconutJob = {
    input: {
      url: sourceUrl,
    },
    outputs: {
      'mp4:1080p': {
        url: outputUrl,
        credentials: {
          access_key: outputAccessKey,
        },
      },
    },
  };

  if (webhookUrl) {
    job.webhook = webhookUrl;
  }

  const response = await fetch(COCONUT_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COCONUT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Coconut API error:', errorText);
    throw new Error(`Coconut API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Create a transcoding job that outputs to Bunny Stream
 * Uses httpstream:// protocol to upload directly
 */
export async function createBunnyStreamTranscodeJob(
  sourceUrl: string,
  bunnyLibraryId: string,
  bunnyVideoId: string,
  bunnyApiKey: string,
  webhookUrl?: string
): Promise<CoconutJobResponse> {
  if (!COCONUT_API_KEY) {
    throw new Error('Coconut API key not configured');
  }

  // Bunny Stream upload URL
  const bunnyUploadUrl = `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos/${bunnyVideoId}`;

  const job = {
    input: {
      url: sourceUrl,
    },
    outputs: {
      'mp4:1080p': {
        url: `httpstream://${bunnyUploadUrl}`,
        credentials: {
          headers: {
            'AccessKey': bunnyApiKey,
          },
        },
      },
    },
    webhook: webhookUrl,
  };

  const response = await fetch(COCONUT_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COCONUT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Coconut API error:', errorText);
    throw new Error(`Coconut API error: ${response.status} - ${errorText}`);
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

  const response = await fetch(`${COCONUT_API_URL}/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${COCONUT_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Coconut API error: ${response.status}`);
  }

  return response.json();
}
