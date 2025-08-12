# Vercel + Railway Deployment Guide

This guide will help you deploy your Media Harvest application with:
- **Frontend**: Vercel (React/Vite)
- **Backend**: Railway (Express.js + yt-dlp + ffmpeg)

## Prerequisites

1. GitHub account with your code pushed to a repository
2. Vercel account (free)
3. Railway account (free $5 credits)

## Step 1: Deploy Backend to Railway

### 1.1 Connect to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your Media Harvest repository

### 1.2 Configure Railway Deployment
1. Railway will auto-detect Node.js
2. Set these environment variables in Railway:
   - `NODE_ENV` = `production`
   - `PORT` = `$PORT` (Railway auto-sets this)

### 1.3 Deploy
1. Railway will automatically build and deploy
2. Wait for deployment to complete
3. Copy your Railway app URL (e.g., `https://your-app-name.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Update API Configuration
First, we need to update your frontend to point to the Railway backend:

1. Create/update your environment configuration
2. Update API base URL to your Railway deployment

### 2.2 Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click "New Project"
4. Import your GitHub repository

### 2.3 Configure Vercel Build Settings
1. **Framework Preset**: Vite
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`

### 2.4 Set Environment Variables
In Vercel dashboard, add:
- `VITE_API_BASE_URL` = `https://your-railway-app.railway.app`

### 2.5 Deploy
1. Click "Deploy"
2. Vercel will build and deploy your frontend
3. Get your Vercel URL (e.g., `https://your-app.vercel.app`)

## Step 3: Update CORS Configuration

Update your backend to allow requests from your Vercel domain:

1. In Railway dashboard, add environment variable:
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

## Step 4: Test the Deployment

1. Visit your Vercel URL
2. Try downloading a video
3. Check that API calls work correctly

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure ALLOWED_ORIGINS is set correctly
2. **API Not Found**: Verify the VITE_API_BASE_URL is correct
3. **Build Failures**: Check build logs in respective platforms

### Railway Specific:
- Check logs in Railway dashboard
- Ensure yt-dlp and ffmpeg are installing correctly
- Monitor resource usage (free tier has limits)

### Vercel Specific:
- Check build logs for any missing dependencies
- Ensure environment variables are set correctly
- Verify the build output directory is `dist`

## Monitoring and Maintenance

### Railway:
- Monitor usage in Railway dashboard
- Free tier: $5 credit per month
- Upgrade if you exceed limits

### Vercel:
- Monitor build minutes and bandwidth
- Free tier: 100GB bandwidth, 6000 build minutes
- Upgrade if needed

## Auto-Deployment

Both platforms support automatic deployment:
- **Railway**: Deploys on push to main branch
- **Vercel**: Deploys on push to main branch

Just push your changes to GitHub and both will automatically redeploy!

## Custom Domains (Optional)

### Vercel:
1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records

### Railway:
1. Go to Project Settings > Domains
2. Add custom domain
3. Configure DNS records

## Cost Optimization

- Both platforms offer generous free tiers
- Railway: $5/month credit (usually sufficient for small apps)
- Vercel: Free for personal projects
- Monitor usage to avoid unexpected charges

## Next Steps

1. Set up monitoring (optional)
2. Configure custom domains (optional)
3. Set up CI/CD workflows (optional)
4. Add database if needed (Railway has built-in databases)

Your Media Harvest app is now live! 🚀