// Vercel serverless function to proxy download requests to Railway backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEFAULT_BACKEND_URL = 'https://media-harvest-production.up.railway.app';
  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL || DEFAULT_BACKEND_URL;
  const usingDefault = !process.env.RAILWAY_BACKEND_URL;
  const TIMEOUT_MS = 45000; // align with client-side ~50s timeout to avoid premature 504s
  const WARMUP_TIMEOUT_MS = 2000; // quick ping to wake backend
  
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
    // Warm-up ping to wake sleeping backend instances
    const warmUpCandidates = [
      `${BACKEND_URL}/api/health`,
      `${BACKEND_URL}/health`,
      `${BACKEND_URL}/`
    ];
    try {
      for (const pingUrl of warmUpCandidates) {
        const pingController = new AbortController();
        const pingTimer = setTimeout(() => pingController.abort(), WARMUP_TIMEOUT_MS);
        const pingRes = await fetch(pingUrl, {
          method: 'GET',
          headers: { 'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0' },
          signal: pingController.signal
        }).catch(() => null);
        clearTimeout(pingTimer);
        if (pingRes && pingRes.ok) {
          console.log('Backend warm-up OK:', { url: pingUrl, status: pingRes.status });
          break;
        }
      }
    } catch (warmErr) {
      console.warn('Backend warm-up failed:', warmErr?.message || warmErr);
    }

    // Helper to perform the download request with timeout
    const doDownload = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/download-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
          },
          body: JSON.stringify(req.body),
          signal: controller.signal
        });
        return { resp, aborted: false };
      } catch (e) {
        return { error: e, aborted: e && e.name === 'AbortError' };
      } finally {
        clearTimeout(timer);
      }
    };

    // First attempt
    let { resp: response, error: firstError, aborted: firstAborted } = await doDownload();
    // Retry once on timeout
    if (!response && firstAborted) {
      console.warn('Download request timed out, retrying once...');
      await new Promise(r => setTimeout(r, 2000));
      const second = await doDownload();
      response = second.resp;
      if (!response) {
        const err = second.error || firstError;
        const isTimeout = second.aborted || firstAborted;
        return res.status(isTimeout ? 504 : 500).json({
          error: isTimeout ? 'Download request timed out' : 'Proxy request failed',
          details: err?.message || String(err),
          backendSource: usingDefault ? 'default' : 'env',
          attempts: 2,
          retry_hint: 'Retry after a few seconds; ensure Railway service is awake and responsive.'
        });
      }
      console.log('Download retry succeeded');
    }

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