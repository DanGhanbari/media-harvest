# Enhanced YouTube Downloader Integration Guide

## Overview

This guide explains how to integrate the enhanced YouTube downloader system into your existing application. The enhanced system provides advanced features like proxy rotation, cookie management, CAPTCHA solving, intelligent retry mechanisms, and comprehensive error handling.

## Quick Start

### 1. Test the Enhanced System

```bash
# Run comprehensive tests
node deploy-enhanced.js

# Deploy to VPS (optional)
node deploy-enhanced.js --deploy
```

### 2. Basic Integration

```javascript
const EnhancedYouTubeDownloader = require('./src/EnhancedYouTubeDownloader');

// Initialize with default configuration
const downloader = new EnhancedYouTubeDownloader();
await downloader.initialize();

// Download a video
const result = await downloader.downloadVideo('https://youtube.com/watch?v=VIDEO_ID', {
    quality: 'high',
    format: 'mp4',
    outputPath: './downloads'
});
```

### 3. Server Integration

```javascript
const ServerIntegration = require('./src/server-integration');

// Add to your Express app
const integration = new ServerIntegration({
    proxies: { enabled: true },
    cookies: { enabled: true },
    captcha: { enabled: false }, // Enable if you have API keys
    health: { enabled: true }
});

await integration.initialize();
integration.setupRoutes(app); // Adds enhanced endpoints
```

## Configuration

### Environment Variables

```bash
# Proxy Configuration
PROXY_ENABLED=true
PROXY_PROVIDERS=residential,datacenter
PROXY_ROTATION_INTERVAL=300000

# Cookie Management
COOKIE_ENABLED=true
COOKIE_REFRESH_INTERVAL=3600000
COOKIE_ACCOUNTS_COUNT=5

# CAPTCHA Solving
CAPTCHA_ENABLED=false
TWOCAPTCHA_API_KEY=your_api_key
ANTICAPTCHA_API_KEY=your_api_key

# Health Monitoring
HEALTH_MONITORING=true
HEALTH_CHECK_INTERVAL=60000

# Logging
LOG_LEVEL=info
LOG_ROTATION=true
LOG_MAX_SIZE=10MB
```

### Advanced Configuration

```javascript
const config = {
    proxies: {
        enabled: true,
        providers: ['residential', 'datacenter'],
        rotationInterval: 5 * 60 * 1000, // 5 minutes
        healthCheckInterval: 30 * 1000,  // 30 seconds
        maxFailures: 3,
        timeout: 10000
    },
    cookies: {
        enabled: true,
        refreshInterval: 60 * 60 * 1000, // 1 hour
        accountsCount: 5,
        rotationStrategy: 'round_robin',
        autoRefresh: true
    },
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true
    },
    download: {
        concurrentDownloads: 3,
        queueSize: 100,
        timeout: 300000, // 5 minutes
        chunkSize: 1024 * 1024 // 1MB
    },
    format: {
        defaultQuality: 'high',
        adaptiveBitrate: true,
        fallbackChain: ['high', 'medium', 'low'],
        networkSpeedTest: true
    },
    health: {
        enabled: true,
        checkInterval: 60 * 1000, // 1 minute
        recoveryActions: true,
        alertThresholds: {
            errorRate: 0.1,        // 10%
            responseTime: 5000,    // 5 seconds
            consecutiveFailures: 5
        }
    },
    error: {
        logLevel: 'info',
        logRotation: true,
        maxLogSize: '10MB',
        retentionDays: 7,
        alerting: {
            enabled: false,
            webhook: null,
            email: null
        }
    }
};
```

## API Endpoints

The enhanced system adds several new endpoints:

### Enhanced Download
```
POST /api/enhanced/download
Body: {
    "url": "https://youtube.com/watch?v=VIDEO_ID",
    "quality": "high",
    "format": "mp4",
    "options": {
        "useProxy": true,
        "priority": "high"
    }
}
```

### Video Information
```
GET /api/enhanced/video-info?url=VIDEO_URL
```

### Bulk Download
```
POST /api/enhanced/bulk-download
Body: {
    "urls": ["URL1", "URL2", "URL3"],
    "quality": "medium",
    "format": "mp4"
}
```

### Health Check
```
GET /api/enhanced/health
```

### Service Statistics
```
GET /api/enhanced/stats
```

### Test Connection
```
GET /api/enhanced/test-connection
```

## Migration from Basic System

### Step 1: Backup Current System
```bash
cp server.js server.js.backup
cp -r src src.backup
```

### Step 2: Install Dependencies
```bash
npm install axios tough-cookie socks-proxy-agent https-proxy-agent
```

### Step 3: Update Server File

```javascript
// Add to the top of server.js
const ServerIntegration = require('./src/server-integration');

// Initialize enhanced system
const enhancedIntegration = new ServerIntegration({
    proxies: { enabled: process.env.PROXY_ENABLED === 'true' },
    cookies: { enabled: process.env.COOKIE_ENABLED === 'true' },
    captcha: { enabled: process.env.CAPTCHA_ENABLED === 'true' },
    health: { enabled: process.env.HEALTH_MONITORING !== 'false' }
});

// Initialize before starting server
enhancedIntegration.initialize().then(() => {
    // Setup enhanced routes
    enhancedIntegration.setupRoutes(app);
    
    // Start server
    app.listen(PORT, () => {
        console.log(`Enhanced server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to initialize enhanced system:', error);
    process.exit(1);
});
```

### Step 4: Update Frontend

Update your frontend to use the new enhanced endpoints:

```javascript
// Old endpoint
fetch('/api/download-video', { ... })

// New enhanced endpoint
fetch('/api/enhanced/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        url: videoUrl,
        quality: 'high',
        format: 'mp4',
        options: {
            useProxy: true,
            priority: 'high'
        }
    })
})
```

## Monitoring and Debugging

### Log Files
- `logs/error.log` - Error logs with rotation
- `logs/access.log` - Access logs
- `logs/health.log` - Health monitoring logs
- `logs/performance.log` - Performance metrics

### Health Monitoring

```javascript
// Get health status
const health = await downloader.getHealthStatus();
console.log('System health:', health);

// Get service statistics
const stats = downloader.getStats();
console.log('Service stats:', stats);

// Monitor events
downloader.on('download:start', (data) => {
    console.log('Download started:', data.url);
});

downloader.on('download:complete', (data) => {
    console.log('Download completed:', data.url, data.duration);
});

downloader.on('error', (error) => {
    console.error('System error:', error);
});
```

### Performance Monitoring

```javascript
// Get performance metrics
const metrics = await downloader.getPerformanceMetrics();
console.log('Performance:', {
    averageDownloadTime: metrics.averageDownloadTime,
    successRate: metrics.successRate,
    errorRate: metrics.errorRate,
    activeDownloads: metrics.activeDownloads
});
```

## Troubleshooting

### Common Issues

1. **Proxy Connection Failures**
   - Check proxy provider credentials
   - Verify network connectivity
   - Review proxy rotation settings

2. **Cookie Expiration**
   - Enable automatic cookie refresh
   - Check cookie extraction process
   - Verify account credentials

3. **CAPTCHA Challenges**
   - Enable CAPTCHA solving service
   - Check API key configuration
   - Monitor solving success rate

4. **High Memory Usage**
   - Reduce concurrent downloads
   - Enable log rotation
   - Monitor queue size

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug node server.js

# Run with enhanced debugging
DEBUG=enhanced:* node server.js
```

### Performance Tuning

```javascript
// Optimize for high-volume downloads
const config = {
    download: {
        concurrentDownloads: 5,
        queueSize: 200,
        timeout: 600000 // 10 minutes
    },
    retry: {
        maxAttempts: 3,
        baseDelay: 500,
        maxDelay: 10000
    },
    health: {
        checkInterval: 30000 // 30 seconds
    }
};
```

## Production Deployment

### VPS Deployment

```bash
# Deploy to VPS
node deploy-enhanced.js --deploy

# Manual deployment
rsync -avz --exclude node_modules . user@server:/path/to/app/
ssh user@server "cd /path/to/app && npm install && pm2 restart app"
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Setup

```bash
# Production environment variables
export NODE_ENV=production
export PROXY_ENABLED=true
export COOKIE_ENABLED=true
export HEALTH_MONITORING=true
export LOG_LEVEL=info
```

## Support

For issues and questions:
1. Check the deployment report: `deployment-report.json`
2. Review log files in the `logs/` directory
3. Run the test suite: `node deploy-enhanced.js`
4. Monitor health endpoints: `/api/enhanced/health`

## License

This enhanced system maintains the same license as the original project.