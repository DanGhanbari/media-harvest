# 🚀 Quick Deploy Guide: Vercel + Railway

This is a streamlined guide to deploy your Media Harvest app with Vercel (frontend) and Railway (backend).

## ⚡ Quick Start (5 minutes)

### 1. Prepare Your Code
```bash
# Make sure your code is committed to git
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Deploy Backend to Railway
1. Go to [railway.app](https://railway.app) and login with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway auto-detects Node.js and deploys automatically
5. **Copy your Railway URL** (e.g., `https://media-tools-production.up.railway.app`)

### 3. Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com) and login with GitHub
2. Click **"New Project"** → Import your repository
3. Configure:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: Your Railway URL (from step 2)
5. Click **"Deploy"**

### 4. Configure CORS
1. In Railway dashboard, go to your project
2. Add environment variable:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: Your Vercel URL (e.g., `https://media-harvest.vercel.app`)
3. Redeploy if needed

## ✅ That's it!

Your app is now live:
- **Frontend**: Your Vercel URL
- **Backend**: Your Railway URL
- **Auto-deploy**: Both platforms redeploy when you push to GitHub

## 🛠️ Alternative: Use the Setup Script

```bash
# Run the automated setup script
npm run deploy:setup

# Or manually:
./deploy.sh
```

## 🔧 Useful Commands

```bash
# Build for production
npm run build:prod

# Check everything before deploy
npm run deploy:check

# Test locally
npm run dev:full
```

## 🐛 Troubleshooting

### CORS Issues
- Make sure `ALLOWED_ORIGINS` in Railway matches your Vercel URL exactly
- Check Railway logs for CORS errors

### API Not Working
- Verify `VITE_API_BASE_URL` in Vercel matches your Railway URL
- Test Railway backend directly: `https://your-app.railway.app/api/health`

### Build Failures
- Check build logs in respective platforms
- Ensure all dependencies are in `package.json`

## 💰 Cost

- **Railway**: $5/month free credits (usually sufficient)
- **Vercel**: Free for personal projects
- **Total**: Essentially free for small to medium usage

## 📚 Need More Details?

See the comprehensive guide: [VERCEL_RAILWAY_DEPLOYMENT.md](./VERCEL_RAILWAY_DEPLOYMENT.md)

---

**Happy deploying! 🎉**