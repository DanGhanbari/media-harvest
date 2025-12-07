// Vercel serverless function to proxy quality options requests to Railway backend
export default async function handler(req, res) {
  // Allow GET requests (frontend uses GET for quality-options)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL;
  if (!BACKEND_URL) {
    return res.status(500).json({
      error: 'Backend URL not configured',
      details: 'Set environment variable RAILWAY_BACKEND_URL to your Railway backend base URL.'
    });
  }
  
  try {
    // Forward the request to the Railway backend
    const response = await fetch(`${BACKEND_URL}/api/quality-options`, {
      method: 'GET',
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed',
      details: error.message 
    });
  }
}