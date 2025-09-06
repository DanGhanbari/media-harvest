// Vercel serverless function to proxy video info requests to VPS backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const VPS_BACKEND_URL = 'https://harassment-administrative-prophet-finance.trycloudflare.com';
  
  try {
    // Forward the request to the VPS backend
    const response = await fetch(`${VPS_BACKEND_URL}/api/video-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
      },
      body: JSON.stringify(req.body)
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