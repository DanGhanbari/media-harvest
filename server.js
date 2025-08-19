import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import cors from 'cors';
import archiver from 'archiver';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import http from 'http';
// Added multer for video file uploads

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store WebSocket connections by session ID
const wsConnections = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 DEBUG: WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('🔌 DEBUG: Received WebSocket message:', data);
      if (data.type === 'register' && data.sessionId) {
        wsConnections.set(data.sessionId, ws);
        console.log(`🔌 DEBUG: WebSocket registered for session: ${data.sessionId}`);
        console.log(`🔌 DEBUG: Total registered sessions: ${wsConnections.size}`);
      }
    } catch (error) {
      console.error('🔌 DEBUG: WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove connection from map when client disconnects
    for (const [sessionId, connection] of wsConnections.entries()) {
      if (connection === ws) {
        wsConnections.delete(sessionId);
        console.log(`WebSocket disconnected for session: ${sessionId}`);
        break;
      }
    }
  });
});

// Function to send progress updates via WebSocket
function sendProgressUpdate(sessionId, type, progress, details = {}) {
  const ws = wsConnections.get(sessionId);
  console.log(`📡 DEBUG: Attempting to send progress update for session: ${sessionId}`);
  console.log(`📡 DEBUG: WebSocket found: ${!!ws}, ReadyState: ${ws?.readyState}`);
  console.log(`📡 DEBUG: Total active connections: ${wsConnections.size}`);
  
  if (ws && ws.readyState === ws.OPEN) {
    const message = {
      type: 'progress',
      operation: type,
      progress: progress,
      ...details
    };
    console.log(`📡 DEBUG: Sending WebSocket message:`, message);
    ws.send(JSON.stringify(message));
  } else {
    console.log(`📡 DEBUG: Cannot send progress - WebSocket not available or not open`);
    console.log(`📡 DEBUG: Available sessions:`, Array.from(wsConnections.keys()));
  }
}

// CORS configuration for production deployment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim())
      : [
          'http://localhost:3000',
          'http://localhost:5173', // Vite dev server
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          'http://localhost:3002'
        ];
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'dist')));

app.use(express.json({ limit: '10mb' }));

// Configure multer for video file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files including MXF
    // Also accept files without extensions if they have video mimetype
    if (file.mimetype.startsWith('video/') || 
        file.originalname.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mxf)$/i) ||
        (file.mimetype === 'application/octet-stream' && !path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Check if yt-dlp is installed
function checkYtDlp() {
  return new Promise((resolve) => {
    const ytDlp = spawn('yt-dlp', ['--version']);
    ytDlp.on('close', (code) => {
      resolve(code === 0);
    });
    ytDlp.on('error', () => {
      resolve(false);
    });
  });
}

// Function to detect production environment
function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' || 
         process.env.RAILWAY_ENVIRONMENT === 'production' ||
         process.env.RAILWAY_PROJECT_ID || 
         process.env.PORT === '3000' || // Railway default port
         process.env.HOSTNAME?.includes('railway.app');
}

// Detect platform from URL
function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube';
  } else if (urlLower.includes('instagram.com')) {
    return 'instagram';
  } else if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
    return 'facebook';
  } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter';
  } else if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  } else if (urlLower.includes('vimeo.com')) {
    return 'vimeo';
  } else if (urlLower.includes('dailymotion.com')) {
    return 'dailymotion';
  } else if (urlLower.includes('twitch.tv')) {
    return 'twitch';
  } else if (urlLower.includes('reddit.com')) {
    return 'reddit';
  } else if (urlLower.includes('streamable.com')) {
    return 'streamable';
  } else if (urlLower.includes('rumble.com')) {
    return 'rumble';
  } else if (urlLower.includes('bitchute.com')) {
    return 'bitchute';
  } else if (urlLower.includes('odysee.com') || urlLower.includes('lbry.tv')) {
    return 'odysee';
  } else if (urlLower.includes('pornhub.com')) {
    return 'pornhub';
  } else if (urlLower.includes('xvideos.com')) {
    return 'xvideos';
  } else if (urlLower.match(/\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v)$/i)) {
    return 'direct-video';
  } else {
    return 'generic';
  }
}

// Quality format mappings
const qualityFormats = {
  'maximum': 'bestvideo[height>=2160]+bestaudio/bestvideo[height>=1440]+bestaudio/bestvideo[height>=1080]+bestaudio/bestvideo+bestaudio/best',
  'high': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best',
  'medium': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/bestvideo[height<=720]+bestaudio/best',
  'low': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/bestvideo[height<=480]+bestaudio/best',
  'audio': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio'
};

// Get available quality options endpoint
// Removed manual cookie upload endpoint - using automated extraction instead

// Test endpoint to verify deployment version
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    hasConvertEndpoint: true,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'local'
  });
});

app.get('/api/quality-options', (req, res) => {
  res.json({
    options: [
      { value: 'maximum', label: 'Maximum Quality (4K/1440p/1080p+)', description: 'Best available quality up to 4K' },
      { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
      { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
      { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' },
      { value: 'audio', label: 'Audio Only', description: 'Extract audio only (M4A/MP3)' }
    ]
  });
});

// Track active downloads
const activeDownloads = new Map();

// Cancel download endpoint
app.post('/api/cancel-download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  const downloadInfo = activeDownloads.get(url);
  if (downloadInfo) {
    const { ytDlp, tempDir, cleanup } = downloadInfo;
    
    if (ytDlp && !ytDlp.killed) {
      ytDlp.kill('SIGTERM');
      setTimeout(() => {
        if (ytDlp && !ytDlp.killed) {
          ytDlp.kill('SIGKILL');
        }
      }, 2000);
    }
    
    if (cleanup) cleanup();
    activeDownloads.delete(url);
    
    res.json({ success: true, message: 'Download cancelled' });
  } else {
    res.status(404).json({ error: 'No active download found for this URL' });
  }
});

// Download video from supported platforms (YouTube, Instagram, Facebook, Twitter)
app.post('/api/download-video', async (req, res) => {
  const { url, filename, quality = 'high', sessionId } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate quality option
  if (!qualityFormats[quality]) {
    return res.status(400).json({ error: 'Invalid quality option' });
  }

  // Check if yt-dlp is available
  const ytDlpAvailable = await checkYtDlp();
  if (!ytDlpAvailable) {
    return res.status(500).json({ 
      error: 'yt-dlp is not installed. Please install it with: pip install yt-dlp' 
    });
  }

  let ytDlp = null;
  let tempDir = null;
  
  // Handle request cancellation
  const cleanup = () => {
    if (ytDlp && !ytDlp.killed) {
      ytDlp.kill('SIGTERM');
      // Force kill if SIGTERM doesn't work
      setTimeout(() => {
        if (ytDlp && !ytDlp.killed) {
          ytDlp.kill('SIGKILL');
        }
      }, 5000);
    }
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up temp directory:', err);
      }
    }
    // Remove from active downloads
    activeDownloads.delete(url);
  };
  
  req.on('close', cleanup);
  req.on('aborted', cleanup);
  
  // Also check if request is already aborted
  if (req.aborted) {
    return;
  }

  try {
    // Create a temporary directory for downloads
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-'));
    const outputTemplate = path.join(tempDir, '%(title)s_%(id)s_%(playlist_index)s.%(ext)s');
    
    // Detect platform and adjust settings accordingly
    const platform = detectPlatform(url);
    
    // Base arguments for all platforms
    const baseArgs = [
      '--format', qualityFormats[quality],
      '--output', outputTemplate,
      '--restrict-filenames', // Use safe filenames
      '--embed-metadata',
      '--verbose',
      '--progress', // Enable progress output
      '--newline' // Each progress line on new line
    ];

    // Platform-specific configurations
    if (platform === 'instagram') {
      // Instagram-specific arguments for carousel handling
      var ytDlpArgs = [
        ...baseArgs,
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', url,
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--retry-sleep', 'linear=1::2',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '--ignore-errors', // Continue on errors for individual items
        '--write-info-json', // Get metadata for each item
        '--write-thumbnail', // Download thumbnails
        // DO NOT add --no-playlist for Instagram to allow carousel downloads
        '--yes-playlist' // Explicitly enable playlist/carousel extraction
      ];
      
      // Try multiple browser cookie sources automatically
      const browsers = ['chrome', 'firefox', 'edge', 'safari'];
      let cookiesAdded = false;
      
      // First try environment variable for explicit cookie file
      if (process.env.IG_COOKIES_FILE && fs.existsSync(process.env.IG_COOKIES_FILE)) {
        ytDlpArgs.push('--cookies', process.env.IG_COOKIES_FILE);
        cookiesAdded = true;
      }
      // Then try browser cookies automatically (only works in development)
      else if (!isProductionEnvironment()) {
        for (const browser of browsers) {
          try {
            ytDlpArgs.push('--cookies-from-browser', `${browser}:Default`);
            cookiesAdded = true;
            break; // Use first successful browser
          } catch (e) {
            // Try next browser
            continue;
          }
        }
      }
    } else if (platform === 'facebook') {
      // Facebook-specific arguments  
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist', // For Facebook, use no-playlist
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', url,
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--retry-sleep', 'linear=1::2',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5'
      ];
      
      // Try to use cookies from browser if available
      try {
        ytDlpArgs.push('--cookies-from-browser', 'chrome:Default');
      } catch (e) {
        // Continue without authentication
      }
    } else if (platform === 'youtube') {
      // YouTube-specific arguments with robust error handling
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist',
        '--no-abort-on-error',
        '--ignore-errors',
        '--extractor-retries', '10',
        '--fragment-retries', '10',
        '--retry-sleep', 'linear=1::5',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--sleep-interval', '2',
        '--max-sleep-interval', '10',
        '--force-ipv4', // Force IPv4 to avoid some network issues
        '--no-check-certificate', // Skip certificate verification
        '--geo-bypass', // Try to bypass geo-restrictions
        '--age-limit', '0' // No age limit restrictions
      ];
      
      // Try to use cookies for YouTube authentication if available
      if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
        ytDlpArgs.push('--cookies', process.env.YOUTUBE_COOKIES_FILE);
      }
      // In development, try browser cookies automatically
      else if (!isProductionEnvironment()) {
        const browsers = ['chrome', 'firefox', 'edge', 'safari'];
        for (const browser of browsers) {
          try {
            ytDlpArgs.push('--cookies-from-browser', `${browser}:Default`);
            break; // Use first successful browser
          } catch (e) {
            // Try next browser
            continue;
          }
        }
      }
    } else {
      // Default arguments for other platforms
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist' // Default behavior for non-Instagram platforms
      ];
    }
    
    if (platform === 'twitter') {
      // Twitter-specific optimizations
      ytDlpArgs.push('--no-check-certificate');
    }
    
    if (platform === 'generic' || platform === 'direct-video') {
      // For generic websites, add more robust extraction options
      ytDlpArgs.push(
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--referer', url,
        '--extract-flat', 'false'
      );
      
      // For direct video files, try to download directly
      if (platform === 'direct-video') {
        ytDlpArgs.push('--no-playlist', '--ignore-errors');
      }
    }
    
    if (platform === 'reddit') {
      // Reddit-specific optimizations
      ytDlpArgs.push('--no-check-certificate');
    }

    // Add merge format for video qualities
    if (quality !== 'audio') {
      ytDlpArgs.splice(2, 0, '--merge-output-format', 'mp4');
      ytDlpArgs.push('--write-thumbnail', '--embed-thumbnail');
    }
    
    ytDlpArgs.push(url);
    
    ytDlp = spawn('yt-dlp', ytDlpArgs);
    
    // Register this download in the active downloads map
    activeDownloads.set(url, { ytDlp, tempDir, cleanup });
    
    let stderr = '';
    let stdout = '';
    
    // Periodically check if client is still connected
    const connectionCheck = setInterval(() => {
      if (res.destroyed || !res.writable) {
        clearInterval(connectionCheck);
        cleanup();
      }
    }, 1000); // Check every second
    
    // Clear interval when process completes
    const clearConnectionCheck = () => {
      clearInterval(connectionCheck);
    };
    
    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ytDlp.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output);
      
      // Parse progress from yt-dlp output
      if (sessionId) {
        const lines = output.split('\n');
        for (const line of lines) {
          // Debug: Log ALL stderr lines to see what yt-dlp is actually outputting
          if (line.trim()) {
            console.log('🔍 DEBUG: yt-dlp stderr line:', JSON.stringify(line));
          }
          
          // Debug: Log all lines that contain 'download' to see the actual format
          if (line.includes('[download]')) {
            console.log('🔍 DEBUG: yt-dlp download line:', JSON.stringify(line));
          }
          
          // Look for download progress with multiple possible formats:
          // [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:30
          // [download] 45.2% of ~123.45MiB at 1.23MiB/s ETA 00:30
          // [download]   45.2% of 123.45MiB at  1.23MiB/s ETA 00:30
          const progressMatch = line.match(/\[download\]\s*(\d+(?:\.\d+)?)%/) || 
                               line.match(/\[download\].*?(\d+(?:\.\d+)?)%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            console.log('📊 DEBUG: Progress parsed:', progress + '% from line:', JSON.stringify(line));
            
            // Extract additional details with more flexible patterns
            const sizeMatch = line.match(/of\s*~?([\d.]+\w+)/) || line.match(/([\d.]+\w+)\s*total/);
            const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/) || line.match(/([\d.]+\w+\/s)/);
            const etaMatch = line.match(/ETA\s+(\d+:\d+)/) || line.match(/eta\s+(\d+:\d+)/i);
            
            console.log('📡 DEBUG: Sending progress update via WebSocket');
            sendProgressUpdate(sessionId, 'download', progress, {
              size: sizeMatch ? sizeMatch[1] : null,
              speed: speedMatch ? speedMatch[1] : null,
              eta: etaMatch ? etaMatch[1] : null
            });
          }
        }
      }
    });
    
    ytDlp.on('close', (code) => {
      clearConnectionCheck();
      
      // Handle Instagram/Facebook authentication failures with helpful error messages
      if (code !== 0 && (platform === 'instagram' || platform === 'facebook')) {
        const errorOutput = stderr.toLowerCase();
        if (errorOutput.includes('login required') || errorOutput.includes('authentication') || 
            errorOutput.includes('cookies') || errorOutput.includes('rate-limit')) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          
          const isProduction = isProductionEnvironment();
          const errorMessage = isProduction 
            ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} authentication not available in production`
            : `${platform.charAt(0).toUpperCase() + platform.slice(1)} requires authentication`;
          
          const details = isProduction
            ? `Instagram downloads require browser cookies which are not available on the production server. This is a limitation of the hosting environment. Try:
1. Using a public Instagram post URL (some may work without authentication)
2. Running the application locally for Instagram downloads
3. Using alternative platforms like YouTube, TikTok, or Twitter`
            : `This ${platform} content requires login. The platform has restricted access to prevent automated downloads. Try:
1. Using a public post URL instead of private content
2. Checking if the content is publicly accessible
3. The content may be geo-restricted or require account access`;
          
          return res.status(403).json({ 
            error: errorMessage,
            details: details,
            platform: platform,
            isProduction: isProduction,
            suggestion: 'Try downloading from YouTube, TikTok, or Twitter instead, which work more reliably.'
          });
        }
      }
      
      if (code === 0) {
        // Find the downloaded files (handle carousel posts with multiple files)
        const files = fs.readdirSync(tempDir).filter(file => 
          // Filter out info.json files and thumbnails, keep media files
          !/\.(info\.json|description|annotations\.xml)$/i.test(file) &&
          !/thumbnail/i.test(file)
        );
        
        if (files.length > 0) {
          // Sort files to prioritize videos over images
          const sortedFiles = files.sort((a, b) => {
            const aIsVideo = /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(a);
            const bIsVideo = /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(b);
            if (aIsVideo && !bIsVideo) return -1;
            if (!aIsVideo && bIsVideo) return 1;
            return a.localeCompare(b);
          });
          
          // If multiple files (carousel post), create a zip archive
          if (sortedFiles.length > 1 && platform === 'instagram') {
            
            const zipFilename = `${filename || 'instagram_carousel'}.zip`;
            res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
            res.setHeader('Content-Type', 'application/zip');
            
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            // Handle client disconnect
            res.on('close', () => {
              archive.destroy();
              fs.rmSync(tempDir, { recursive: true, force: true });
            });
            
            // Handle archive errors
            archive.on('error', (err) => {
              console.error('Archive error:', err);
              res.status(500).json({ error: 'Failed to create archive' });
              fs.rmSync(tempDir, { recursive: true, force: true });
            });
            
            // Pipe archive to response
            archive.pipe(res);
            
            // Add files to archive
            sortedFiles.forEach((file, index) => {
              const filePath = path.join(tempDir, file);
              const ext = path.extname(file);
              const baseName = path.basename(file, ext);
              // Create meaningful names for carousel items
              const archiveName = `carousel_item_${index + 1}_${baseName}${ext}`;
              archive.file(filePath, { name: archiveName });
            });
            
            // Finalize archive
            archive.finalize();
            
            // Clean up after sending
            archive.on('end', () => {
              fs.rmSync(tempDir, { recursive: true, force: true });
            });
            
          } else {
            // Single file - send as normal
            const downloadedFile = path.join(tempDir, sortedFiles[0]);
            const stats = fs.statSync(downloadedFile);
            
            // Send file as download
            const finalFilename = filename || sortedFiles[0];
            res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', stats.size);
            
            const fileStream = fs.createReadStream(downloadedFile);
            
            // Handle client disconnect during file streaming
            res.on('close', () => {
              fileStream.destroy();
              fs.rmSync(tempDir, { recursive: true, force: true });
            });
            
            fileStream.pipe(res);
            
            // Clean up after sending
             fileStream.on('end', () => {
               fs.rmSync(tempDir, { recursive: true, force: true });
             });
            
             fileStream.on('error', (error) => {
               console.error('File stream error:', error);
               fs.rmSync(tempDir, { recursive: true, force: true });
               if (!res.headersSent) {
                 res.status(500).json({ error: 'Failed to send file' });
               }
             });
           }
        } else {
          fs.rmSync(tempDir, { recursive: true, force: true });
          res.status(500).json({ error: 'No file was downloaded' });
        }
      } else {
        fs.rmSync(tempDir, { recursive: true, force: true });
        res.status(500).json({ 
          error: `yt-dlp failed with code ${code}`,
          details: stderr || stdout
        });
      }
    });
    
    ytDlp.on('error', (error) => {
      clearConnectionCheck();
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to start yt-dlp',
          details: error.message 
        });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const ytDlpAvailable = await checkYtDlp();
  res.json({ 
    status: 'ok',
    ytDlpAvailable,
    message: ytDlpAvailable ? 'yt-dlp is available' : 'yt-dlp is not installed'
  });
});

// Probe audio channels in uploaded video
app.post('/api/probe-audio', upload.single('video'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-probe-'));
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const inputPath = req.file.path;
    console.log(`[PROBE-AUDIO] Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`[PROBE-AUDIO] File size: ${req.file.size} bytes`);
    console.log(`[PROBE-AUDIO] Temp path: ${inputPath}`);
    
    // Use ffprobe to get audio stream information
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'a',
      inputPath
    ];
    
    const ffprobeProcess = spawn('ffprobe', ffprobeArgs);
    
    let probeOutput = '';
    let errorOutput = '';
    
    ffprobeProcess.stdout.on('data', (data) => {
      probeOutput += data.toString();
    });
    
    ffprobeProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('FFprobe stderr:', errorOutput);
          reject(new Error(`FFprobe failed with code ${code}: ${errorOutput}`));
        }
      });
    });
    
    if (!probeOutput.trim()) {
      console.error('FFprobe returned empty output for file:', req.file.originalname);
      return res.json({ channels: [], hasAudio: false, error: 'No probe data returned' });
    }
    
    let probeData;
    try {
      probeData = JSON.parse(probeOutput);
    } catch (parseError) {
      console.error('Failed to parse FFprobe output:', parseError.message);
      console.error('Raw output:', probeOutput);
      return res.status(500).json({ 
        error: 'Failed to parse audio probe data', 
        details: parseError.message 
      });
    }
    
    const audioStreams = probeData.streams || [];
    console.log(`[PROBE-AUDIO] Found ${audioStreams.length} audio streams`);
    
    if (audioStreams.length === 0) {
      console.log(`[PROBE-AUDIO] No audio streams found - video-only file`);
      return res.json({ 
        channels: [], 
        hasAudio: false,
        message: 'This video file contains no audio streams. Video conversion will proceed without audio processing.'
      });
    }
    
    // Handle MXF files with multiple mono streams by aggregating all channels
    const channels = [];
    let totalChannels = 0;
    
    audioStreams.forEach((stream, streamIndex) => {
      const streamChannels = stream.channels || 0;
      const streamLayout = stream.channel_layout || 'unknown';
      
      console.log(`[PROBE-AUDIO] Stream ${streamIndex}: ${streamChannels} channels, Layout: ${streamLayout}`);
      
      for (let i = 0; i < streamChannels; i++) {
        channels.push({
          index: totalChannels,
          label: `Stream ${streamIndex + 1} Ch ${i + 1}`,
          description: `Stream ${streamIndex + 1} - ${getChannelDescription(i, streamLayout)}`
        });
        totalChannels++;
      }
    });
    
    console.log(`[PROBE-AUDIO] Total channels across all streams: ${totalChannels}`);
    
    // Use first stream info for codec details
    const firstAudioStream = audioStreams[0];
    const channelLayout = audioStreams.length > 1 ? 'multi-stream' : (firstAudioStream.channel_layout || 'unknown');
    
    const response = {
      channels,
      hasAudio: true,
      channelCount: totalChannels,
      channelLayout,
      streamCount: audioStreams.length,
      streamInfo: {
        codec: firstAudioStream.codec_name,
        sampleRate: firstAudioStream.sample_rate,
        bitRate: firstAudioStream.bit_rate
      }
    };
    console.log(`[PROBE-AUDIO] Sending response:`, JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('Audio probe error:', error);
    res.status(500).json({ 
      error: 'Failed to probe audio channels', 
      details: error.message 
    });
  } finally {
    // Clean up temp files
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

// Helper function to get channel description based on layout
function getChannelDescription(index, layout) {
  const commonLayouts = {
    'mono': ['Center'],
    'stereo': ['Left', 'Right'],
    '2.1': ['Left', 'Right', 'LFE'],
    '3.0': ['Left', 'Right', 'Center'],
    '4.0': ['Front Left', 'Front Right', 'Back Left', 'Back Right'],
    '5.0': ['Front Left', 'Front Right', 'Center', 'Back Left', 'Back Right'],
    '5.1': ['Front Left', 'Front Right', 'Center', 'LFE', 'Back Left', 'Back Right'],
    '7.1': ['Front Left', 'Front Right', 'Center', 'LFE', 'Back Left', 'Back Right', 'Side Left', 'Side Right']
  };
  
  const layoutKey = layout.toLowerCase();
  if (commonLayouts[layoutKey] && commonLayouts[layoutKey][index]) {
    return commonLayouts[layoutKey][index];
  }
  
  return `Channel ${index + 1}`;
}

// Video conversion endpoint
app.post('/api/convert-video', upload.single('video'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-convert-'));
  
  try {
    const { format = 'mp4', quality = 'medium', leftChannel, rightChannel, resolution, sessionId } = req.body;
    
    console.log('🎬 SERVER DEBUG: Conversion request received with sessionId:', sessionId);
    console.log('🎬 SERVER DEBUG: Request body keys:', Object.keys(req.body));
    
    // Validate that a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided. Please upload a video file.' });
    }
    
    // Input validation
    const validFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'mp3', 'wav'];
    const validQualities = ['low', 'medium', 'high', 'maximum'];
    const validResolutions = ['original', '1920x1080', '1280x720', '854x480'];
    
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format', 
        details: `Supported formats: ${validFormats.join(', ')}` 
      });
    }
    
    if (!validQualities.includes(quality)) {
      return res.status(400).json({ 
        error: 'Invalid quality', 
        details: `Supported qualities: ${validQualities.join(', ')}` 
      });
    }

    if (resolution && !validResolutions.includes(resolution)) {
      return res.status(400).json({ 
        error: 'Invalid resolution', 
        details: `Supported resolutions: ${validResolutions.join(', ')}` 
      });
    }
    
    // Validate channel parameters if provided
    if ((leftChannel !== undefined || rightChannel !== undefined) && 
        (leftChannel === undefined || rightChannel === undefined)) {
      return res.status(400).json({ 
        error: 'Invalid channel mapping', 
        details: 'Both leftChannel and rightChannel must be provided together' 
      });
    }
    
    // Parse channel parameters
    let leftCh, rightCh;
    if (leftChannel !== undefined && rightChannel !== undefined) {
      leftCh = parseInt(leftChannel);
      rightCh = parseInt(rightChannel);
      
      if (isNaN(leftCh) || isNaN(rightCh) || leftCh < 0 || rightCh < 0) {
        return res.status(400).json({ 
          error: 'Invalid channel indices', 
          details: 'Channel indices must be non-negative integers' 
        });
      }
    }
    
    // Set up input file path and filename
    const inputPath = req.file.path;
    const originalFilename = path.parse(req.file.originalname).name;
    
    console.log(`[CONVERT] Starting conversion - Format: ${format}, Quality: ${quality}, Channels: ${leftChannel}-${rightChannel}`);
    console.log(`[CONVERT] Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`[CONVERT] File size: ${req.file.size} bytes`);
    console.log(`[CONVERT] Temp path: ${inputPath}`);
    
    // Set up output path
    const outputFilename = `${originalFilename}_converted.${format}`;
    const outputPath = path.join(tempDir, outputFilename);
    
    // Configure ffmpeg arguments based on format and quality
    let ffmpegArgs = ['-i', inputPath];
    
    // Handle audio channel mapping if specified
    if (leftChannel !== undefined && rightChannel !== undefined) {
      try {
        // Validate channel parameters
        const leftCh = parseInt(leftChannel);
        const rightCh = parseInt(rightChannel);
        
        if (isNaN(leftCh) || isNaN(rightCh) || leftCh < 0 || rightCh < 0) {
          throw new Error(`Invalid channel parameters: left=${leftChannel}, right=${rightChannel}`);
        }
        
        console.log(`Debug: Mapping audio channels - Left: ${leftCh}, Right: ${rightCh}`);
        
        // First, probe the input to determine the number of audio streams
        const probeArgs = ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'a', inputPath];
        const probeProcess = spawn('ffprobe', probeArgs);
        
        let probeOutput = '';
        let probeError = '';
        
        probeProcess.stdout.on('data', (data) => {
          probeOutput += data.toString();
        });
        
        probeProcess.stderr.on('data', (data) => {
          probeError += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          probeProcess.on('close', (code) => {
            if (code === 0 && probeOutput.trim()) {
              resolve();
            } else {
              reject(new Error(`Failed to probe audio streams: ${probeError || 'No output'}`));
            }
          });
        });
        
        let probeData;
        try {
          probeData = JSON.parse(probeOutput);
        } catch (parseError) {
          throw new Error(`Failed to parse probe output: ${parseError.message}`);
        }
        
        const audioStreams = probeData.streams || [];
        const streamCount = audioStreams.length;
        
        if (streamCount === 0) {
          console.log('No audio streams found - will process as video-only file');
          // For video-only files, skip audio channel mapping and continue with conversion
        } else {
        
        console.log(`Debug: Found ${streamCount} audio streams`);
        
        // Validate channel indices against available channels
        let totalChannels = 0;
        audioStreams.forEach(stream => {
          totalChannels += stream.channels || 1;
        });
        
        if (leftCh >= totalChannels || rightCh >= totalChannels) {
          throw new Error(`Channel index out of range. Available channels: 0-${totalChannels-1}, requested: ${leftCh}, ${rightCh}`);
        }
        
        if (streamCount > 1) {
          // For multiple mono streams (like MXF), merge them first then map channels
          ffmpegArgs.push(
            '-filter_complex', 
            `amerge=inputs=${streamCount}[merged];[merged]channelmap=map=${leftCh}|${rightCh}:channel_layout=stereo[aout]`,
            '-map', '0:v:0',
            '-map', '[aout]',
            '-avoid_negative_ts', 'make_zero'
          );
        } else {
          // For single stream with multiple channels
          const audioStream = audioStreams[0];
          const channels = audioStream.channels || 1;
          
          if (channels === 2 && leftCh === 0 && rightCh === 1) {
            // If it's already stereo and we want L=0, R=1, just copy the audio
            ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0');
          } else if (channels >= 2) {
            // For stereo/multi-channel, use channel mapping
            ffmpegArgs.push(
              '-filter_complex', 
              `[0:a]channelmap=map=${leftCh}|${rightCh}:channel_layout=stereo[aout]`,
              '-map', '0:v:0',
              '-map', '[aout]',
              '-avoid_negative_ts', 'make_zero'
            );
          } else {
            // For mono, duplicate the channel
            ffmpegArgs.push(
              '-filter_complex', 
              `[0:a]channelmap=map=0|0:channel_layout=stereo[aout]`,
              '-map', '0:v:0',
              '-map', '[aout]',
              '-avoid_negative_ts', 'make_zero'
            );
          }
        }
        } // Close the else block from the streamCount check
      } catch (channelError) {
        console.error('Audio channel mapping error:', channelError.message);
        throw new Error(`Audio channel mapping failed: ${channelError.message}`);
      }
    }
    
    // Check if we should use stream copy for same format conversion
    // Disable stream copy if resolution scaling is requested
    const useStreamCopy = req.file.originalname.toLowerCase().endsWith('.mp4') && format === 'mp4' && quality === 'medium' && (leftChannel === undefined && rightChannel === undefined) && (!resolution || resolution === 'original');
    
    if (leftChannel === undefined && rightChannel === undefined && !useStreamCopy) {
      // For basic conversion without channel mapping, explicitly map only main streams
      // This excludes attached pictures and other metadata streams
      // Check if input has audio streams first
      try {
        const probeResult = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_streams',
          '-select_streams', 'a',
          inputPath
        ]);
        
        let probeOutput = '';
        probeResult.stdout.on('data', (data) => {
          probeOutput += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          probeResult.on('close', (code) => {
            if (code === 0) {
              try {
                const probeData = JSON.parse(probeOutput);
                const hasAudio = probeData.streams && probeData.streams.length > 0;
                
                if (hasAudio) {
                  ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
                } else {
                  console.log('No audio streams detected - processing as video-only');
                  ffmpegArgs.push('-map', '0:v:0', '-an'); // -an excludes audio
                }
                resolve();
              } catch (parseError) {
                // Fallback to original mapping if probe fails
                ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
                resolve();
              }
            } else {
              // Fallback to original mapping if probe fails
              ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
              resolve();
            }
          });
        });
      } catch (error) {
        // Fallback to original mapping if probe fails
        ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
      }
    }
    
    // Resolution scaling (skip for stream copy and audio-only formats)
    if (!useStreamCopy && resolution && resolution !== 'original' && !['mp3', 'wav'].includes(format)) {
      // Parse resolution string (e.g., "1280x720" -> width=1280, height=720)
      const [width, height] = resolution.split('x').map(Number);
      // Add scaling filter with proper width and height values
      ffmpegArgs.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
    }

    // Quality settings (skip for stream copy)
    if (!useStreamCopy) {
      switch (quality) {
        case 'low':
          ffmpegArgs.push('-crf', '28', '-preset', 'fast');
          break;
        case 'high':
          ffmpegArgs.push('-crf', '18', '-preset', 'slow');
          break;
        case 'maximum':
          ffmpegArgs.push('-crf', '15', '-preset', 'veryslow');
          break;
        default: // medium
          ffmpegArgs.push('-crf', '23', '-preset', 'medium');
      }
    }
    
    // Format-specific settings
    switch (format) {
      case 'webm':
        ffmpegArgs.push('-c:v:0', 'libvpx-vp9', '-c:a:0', 'libopus');
        break;
      case 'avi':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p');
        break;
      case 'mov':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-movflags', '+faststart');
        break;
      case 'mkv':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p');
        break;
      case 'mp3':
        // Check if input has audio before attempting audio-only conversion
        try {
          const probeResult = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'a',
            inputPath
          ]);
          
          let probeOutput = '';
          probeResult.stdout.on('data', (data) => {
            probeOutput += data.toString();
          });
          
          await new Promise((resolve, reject) => {
            probeResult.on('close', (code) => {
              if (code === 0) {
                try {
                  const probeData = JSON.parse(probeOutput);
                  const hasAudio = probeData.streams && probeData.streams.length > 0;
                  
                  if (hasAudio) {
                    ffmpegArgs.push('-vn', '-c:a', 'libmp3lame', '-b:a', '192k');
                  } else {
                    throw new Error('Cannot convert video-only file to MP3 format - no audio streams available');
                  }
                  resolve();
                } catch (parseError) {
                  reject(new Error('Cannot convert to MP3 - audio stream detection failed'));
                }
              } else {
                reject(new Error('Cannot convert to MP3 - audio stream detection failed'));
              }
            });
          });
        } catch (error) {
          throw error;
        }
        break;
      case 'wav':
        // Check if input has audio before attempting audio-only conversion
        try {
          const probeResult = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'a',
            inputPath
          ]);
          
          let probeOutput = '';
          probeResult.stdout.on('data', (data) => {
            probeOutput += data.toString();
          });
          
          await new Promise((resolve, reject) => {
            probeResult.on('close', (code) => {
              if (code === 0) {
                try {
                  const probeData = JSON.parse(probeOutput);
                  const hasAudio = probeData.streams && probeData.streams.length > 0;
                  
                  if (hasAudio) {
                    ffmpegArgs.push('-vn', '-c:a', 'pcm_s16le');
                  } else {
                    throw new Error('Cannot convert video-only file to WAV format - no audio streams available');
                  }
                  resolve();
                } catch (parseError) {
                  reject(new Error('Cannot convert to WAV - audio stream detection failed'));
                }
              } else {
                reject(new Error('Cannot convert to WAV - audio stream detection failed'));
              }
            });
          });
        } catch (error) {
          throw error;
        }
        break;
      default: // mp4
        if (useStreamCopy) {
          // Use stream copy for same format with default quality to avoid codec conflicts
          // Don't use complex mapping with stream copy
          ffmpegArgs.push('-c:v', 'copy', '-c:a', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart');
        } else {
          // Re-encode with compatible settings for quality changes or different input formats
          ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-movflags', '+faststart');
        }
    }
    
    // Add progress tracking arguments
    ffmpegArgs.push('-progress', 'pipe:2', '-y', outputPath);
    
    // Run ffmpeg conversion
    console.log(`Debug: Running FFmpeg with args: ${ffmpegArgs.join(' ')}`);
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    let conversionOutput = '';
    let conversionError = '';
    let videoDuration = null;
    
    ffmpegProcess.stdout.on('data', (data) => {
      conversionOutput += data.toString();
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      conversionOutput += output;
      conversionError += output;
      
      // Parse FFmpeg progress for conversion tracking
      if (sessionId) {
        const lines = output.split('\n');
        for (const line of lines) {
          // Extract video duration from initial output
          if (!videoDuration) {
            const durationMatch = line.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (durationMatch) {
              const hours = parseInt(durationMatch[1]);
              const minutes = parseInt(durationMatch[2]);
              const seconds = parseFloat(durationMatch[3]);
              videoDuration = hours * 3600 + minutes * 60 + seconds;
            }
          }
          
          // Parse progress from time= output
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch && videoDuration) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(100, (currentTime / videoDuration) * 100);
            
            // Extract additional details
            const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/);
            const speedMatch = line.match(/speed=\s*([\d.]+)x/);
            const bitrateMatch = line.match(/bitrate=\s*([\d.]+\w+\/s)/);
            
            sendProgressUpdate(sessionId, 'conversion', progress, {
              currentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds)).padStart(2, '0')}`,
              totalTime: `${String(Math.floor(videoDuration / 3600)).padStart(2, '0')}:${String(Math.floor((videoDuration % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(videoDuration % 60)).padStart(2, '0')}`,
              fps: fpsMatch ? parseFloat(fpsMatch[1]) : null,
              speed: speedMatch ? speedMatch[1] + 'x' : null,
              bitrate: bitrateMatch ? bitrateMatch[1] : null
            });
          }
        }
      }
    });
    
    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg conversion completed successfully');
          resolve();
        } else {
          console.error(`FFmpeg failed with exit code ${code}`);
          console.error('FFmpeg error output:', conversionError);
          console.error('FFmpeg full output:', conversionOutput);
          
          // Extract meaningful error message
          let errorMessage = 'Unknown FFmpeg error';
          if (conversionError.includes('Invalid argument')) {
            errorMessage = 'Invalid FFmpeg arguments or unsupported format';
          } else if (conversionError.includes('No such file')) {
            errorMessage = 'Input file not found or inaccessible';
          } else if (conversionError.includes('Permission denied')) {
            errorMessage = 'Permission denied accessing file';
          } else if (conversionError.includes('amerge')) {
            errorMessage = 'Audio merging failed - check channel configuration';
          } else if (conversionError.includes('channelmap')) {
            errorMessage = 'Audio channel mapping failed - invalid channel indices';
          } else if (conversionError.includes('does not contain any stream')) {
            errorMessage = 'Input file contains no valid streams';
          } else if (conversionError.includes('Invalid data found')) {
            errorMessage = 'Input file is corrupted or invalid format';
          } else if (conversionError.includes('Protocol not found')) {
            errorMessage = 'Network protocol error - unable to access input';
          } else if (conversionError.includes('Connection refused')) {
            errorMessage = 'Network connection failed';
          } else if (conversionError.includes('HTTP error')) {
            errorMessage = 'HTTP error accessing input file';
          } else if (code === 183) {
            errorMessage = `FFmpeg exit code 183 - detailed error: ${conversionError.slice(-200)}`;
          }
          
          reject(new Error(`FFmpeg conversion failed (code ${code}): ${errorMessage}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        reject(new Error(`Failed to start FFmpeg: ${error.message}`));
      });
    });
    
    // Check if output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Conversion completed but output file not found');
    }
    
    // Send the converted file
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
    
  } catch (error) {
    console.error('Video conversion error:', error);
    
    // Clean up temp directory on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    res.status(500).json({ 
      error: 'Video conversion failed', 
      details: error.message 
    });
  }
});

// Serve frontend for all other GET routes (not API routes)
app.get('*', (req, res) => {
  // Only serve frontend for HTML routes (not API, assets, or other static files)
  if (!req.path.startsWith('/api/') && 
      !req.path.startsWith('/assets/') && 
      !req.path.includes('.') && 
      req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    // For all other requests (static files, etc.), let them 404 naturally
    res.status(404).send('File not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log(`WebSocket server available at: ws://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});