// Vercel serverless function to proxy quality options requests to Railway backend
export default async function handler(req, res) {
  // Allow GET requests (frontend uses GET for quality-options)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL;
  if (!BACKEND_URL) {
    // Safe fallback: return static quality options so the UI remains usable
    return res.status(200).json({
      options: [
        { value: 'maximum', label: 'Best Quality', description: 'Best available quality up to 4K' },
        { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
        { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
        { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' }
      ]
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