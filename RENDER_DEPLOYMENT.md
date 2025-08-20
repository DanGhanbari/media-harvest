# Render Deployment Guide

This guide will help you deploy the Media Harvest backend to Render as an alternative to Railway.

## Prerequisites

- GitHub repository with your code
- Render account (free tier available)
- Environment variables configured

## Deployment Steps

### 1. Connect GitHub Repository

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository containing this project

### 2. Configure Service Settings

**Basic Settings:**
- **Name:** `media-harvest-backend`
- **Runtime:** `Node`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `node server.js`
- **Plan:** `Free` (or upgrade as needed)

### 3. Environment Variables

Add the following environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
```

**Optional Environment Variables:**
```
# CORS Configuration (if you need to restrict origins)
# ALLOWED_ORIGINS=https://your-frontend-domain.com,https://another-domain.com

# Add any custom environment variables your app needs
# Example:
# API_KEY=your_api_key_here
# DATABASE_URL=your_database_url_here
```

**Note about CORS:** The backend automatically detects and allows common deployment domains (.onrender.com, .vercel.app, .railway.app). You only need to set `ALLOWED_ORIGINS` if you want to restrict access to specific domains.

### 4. Advanced Settings

**Health Check:**
- **Health Check Path:** `/api/health`

**Auto-Deploy:**
- Enable "Auto-Deploy" to automatically deploy when you push to your main branch

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your application
3. Monitor the build logs for any issues

## Post-Deployment

### Verify Deployment

1. Check the service URL provided by Render
2. Test the health endpoint: `https://your-app.onrender.com/api/health`
3. Test media download functionality

### Monitor Logs

- Use Render's log viewer to monitor application logs
- Check for any yt-dlp related errors
- Monitor performance and response times

## Render vs Railway Comparison

| Feature | Render | Railway |
|---------|--------|----------|
| Free Tier | ✅ 750 hours/month | ✅ $5 credit |
| Build Time | Fast | Fast |
| Cold Starts | ~30 seconds | ~10 seconds |
| Custom Domains | ✅ | ✅ |
| Environment Variables | ✅ | ✅ |
| Logs | ✅ | ✅ |
| Auto-Deploy | ✅ | ✅ |

## Troubleshooting

### Common Issues

1. **Build Failures:**
   - Check that all dependencies are in `package.json`
   - Verify Node.js version compatibility
   - Review build logs for specific errors

2. **yt-dlp Issues:**
   - Render automatically installs Python and pip
   - The app will install yt-dlp during startup
   - Check logs for yt-dlp installation errors

3. **Memory Issues:**
   - Free tier has 512MB RAM limit
   - Consider upgrading to paid plan for better performance
   - Monitor memory usage in logs

4. **Timeout Issues:**
   - Render has request timeout limits
   - Large file downloads may need optimization
   - Consider implementing download queuing

### Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- [GitHub Issues](https://github.com/your-username/media-harvest/issues)

## Alternative Deployment File

If you prefer using a `render.yaml` file for infrastructure as code:

1. The `render.yaml` file is already included in this repository
2. Push the file to your repository
3. Render will automatically detect and use the configuration
4. This provides version-controlled deployment settings

## Next Steps

1. Set up monitoring and alerts
2. Configure custom domain (if needed)
3. Set up CI/CD pipeline
4. Consider implementing caching strategies
5. Monitor usage and upgrade plan if necessary