// Vercel serverless function to proxy download requests to Railway backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEFAULT_BACKEND_URL = 'https://media-harvest-production.up.railway.app';
  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL || DEFAULT_BACKEND_URL;
  const usingDefault = !process.env.RAILWAY_BACKEND_URL;
  const TIMEOUT_MS = 12000; // avoid Vercel 502 by failing fast
  
  try {
    const { url, quality, startTime, endTime } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url in request body' });
    }
    // Basic logging to aid diagnostics without leaking sensitive data
    console.log('Proxying download request:', {
      target: `${BACKEND_URL}/api/download-video`,
      quality,
      startTime,
      endTime,
      userAgent: req.headers['user-agent'] || 'unknown',
      backendSource: usingDefault ? 'default' : 'env'
    });
    // Forward the request to the Railway backend with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${BACKEND_URL}/api/download-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });

    clearTimeout(timer);

    // Handle different response types
    if (response.headers.get('content-type')?.includes('application/json')) {
      // JSON response (likely an error)
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      // Binary response (file download)
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition');
      
      res.setHeader('Content-Type', contentType);
      if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
      }
      
      // Stream the response
      const buffer = await response.arrayBuffer();
      return res.status(response.status).send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    // Fail fast with structured JSON to avoid platform-level 502s
    const isTimeout = error && error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({ 
      error: isTimeout ? 'Download request timed out' : 'Proxy request failed',
      details: error.message,
      backendSource: usingDefault ? 'default' : 'env',
      retry_hint: 'Retry after a few seconds; ensure Railway service is awake and responsive.'
    });
  }
}