// Vercel serverless function to proxy quality options requests to VPS backend
export default async function handler(req, res) {
  // Only allow POST requests (based on the backend implementation)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const VPS_BACKEND_URL = process.env.VPS_BACKEND_URL || 'http://57.129.63.234:3001';
  
  try {
    // Forward the request to the VPS backend (VPS uses GET for quality-options)
    const response = await fetch(`${VPS_BACKEND_URL}/api/quality-options`, {
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