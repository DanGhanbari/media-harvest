import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
// Removed multer import - no longer needed for manual cookie uploads

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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
  const { url, filename, quality = 'high' } = req.body;
  
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
      '--verbose'
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
      stderr += data.toString();
      console.error(data.toString());
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

// Serve frontend for all other GET routes (not API routes)
app.get('*', (req, res) => {
  // Only serve frontend for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});