// Vercel serverless function to proxy quality options requests to Railway backend
export default async function handler(req, res) {
  // Allow GET requests (frontend uses GET for quality-options)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEFAULT_BACKEND_URL = 'https://media-harvest-production.up.railway.app';
  const BACKEND_URL = process.env.RAILWAY_BACKEND_URL || DEFAULT_BACKEND_URL;
  const usingDefault = !process.env.RAILWAY_BACKEND_URL;
  const TIMEOUT_MS = 5000; // guard against platform timeouts / sleeping backend
  
  try {
    // Forward the request to the Railway backend with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${BACKEND_URL}/api/quality-options`, {
      method: 'GET',
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Vercel-Proxy/1.0',
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Backend responded ${response.status}`);
    }

    const data = await response.json();
    // Normalize shape: ensure { options: [...] }
    const options = Array.isArray(data)
      ? data
      : Array.isArray(data.options) ? data.options : [
          { value: 'maximum', label: 'Best Quality', description: 'Best available quality up to 4K' },
          { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
          { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
          { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' }
        ];

    return res.status(200).json({ options, backendSource: usingDefault ? 'default' : 'env' });
  } catch (error) {
    const isAbort = error && (error.name === 'AbortError');
    console.warn('Quality-options fallback due to error:', { message: error.message, abort: isAbort });
    // Static defaults to keep UI usable and avoid 502
    return res.status(200).json({
      options: [
        { value: 'maximum', label: 'Best Quality', description: 'Best available quality up to 4K' },
        { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
        { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
        { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' }
      ],
      backendSource: usingDefault ? 'default' : 'env',
      fallback: 'static'
    });
  }
}