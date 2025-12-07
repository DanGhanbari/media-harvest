// Vercel serverless function to proxy download requests to Railway backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL;
  if (!BACKEND_URL) {
    // Graceful fallback: avoid 500s, return structured error with guidance
    const { url, quality, startTime, endTime } = req.body || {};
    return res.status(503).json({
      error: 'Backend URL not configured',
      details: 'Set environment variable RAILWAY_BACKEND_URL to your Railway backend base URL in Vercel project settings and redeploy.',
      hint: 'Use your Railway public URL, e.g., https://your-app.up.railway.app',
      request: { url, quality, startTime, endTime }
    });
  }
  
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
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    // Forward the request to the Railway backend
    const response = await fetch(`${BACKEND_URL}/api/download-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
      },
      body: JSON.stringify(req.body)
    });

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
    return res.status(500).json({ 
      error: 'Proxy request failed',
      details: error.message 
    });
  }
}