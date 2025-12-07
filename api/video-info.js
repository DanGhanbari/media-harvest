// Vercel serverless function to proxy video info requests to Railway backend
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEFAULT_BACKEND_URL = 'https://media-harvest-production.up.railway.app';
  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL || DEFAULT_BACKEND_URL;
  const usingDefault = !process.env.RAILWAY_BACKEND_URL;
  
  try {
    // Forward the request to the Railway backend
    const response = await fetch(`${BACKEND_URL}/api/video-info`, {
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
    // As a fallback, try oEmbed for YouTube links to avoid hard failures
    try {
      const url = req.body?.url;
      if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedRes = await fetch(oembedUrl, { method: 'GET' });
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          return res.status(200).json({
            title: oembedData.title,
            uploader: oembedData.author_name,
            thumbnail: oembedData.thumbnail_url,
            duration: 0,
            backendSource: usingDefault ? 'default' : 'env'
          });
        }
      }
    } catch (fallbackErr) {
      console.error('Video info fallback error:', fallbackErr);
    }
    return res.status(500).json({
      error: 'Proxy request failed',
      details: error.message,
      backendSource: usingDefault ? 'default' : 'env'
    });
  }
}