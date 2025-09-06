// Vercel serverless function to proxy download requests to VPS backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const VPS_BACKEND_URL = process.env.VPS_BACKEND_URL || 'https://media-tools-production.up.railway.app';
  
  try {
    // Forward the request to the VPS backend
    const response = await fetch(`${VPS_BACKEND_URL}/api/download-video`, {
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