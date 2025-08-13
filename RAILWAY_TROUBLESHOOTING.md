# 🚨 Railway Deployment Troubleshooting Guide

## ✅ Fixed Issues

I've identified and fixed the most common Railway deployment issue:

### 1. **Host Binding Issue (FIXED)**
- **Problem**: Server wasn't binding to `0.0.0.0` <mcreference link="https://docs.railway.com/reference/errors/application-failed-to-respond" index="5">5</mcreference>
- **Solution**: Updated `server.js` to listen on `0.0.0.0`
- **Status**: ✅ Fixed in your code

### 2. **Railway Configuration (ADDED)**
- **Problem**: Missing `railway.toml` configuration
- **Solution**: Created proper Railway configuration file
- **Status**: ✅ Added to your project

## 🔍 Common Railway Deployment Issues

### Issue 1: Application Failed to Respond
**Symptoms**: 502 Bad Gateway errors <mcreference link="https://docs.railway.com/reference/errors/application-failed-to-respond" index="5">5</mcreference>

**Causes & Solutions**:
- ✅ **Host binding**: Fixed - now listening on `0.0.0.0`
- ✅ **Port configuration**: Using `process.env.PORT`
- ✅ **Start command**: Configured in `railway.toml`

### Issue 2: Build Failures
**Symptoms**: Deployment fails during build phase <mcreference link="https://github.com/calendso/calendso/issues/1423" index="1">1</mcreference>

**Common causes**:
- Dependency conflicts (npm ERESOLVE errors)
- Missing build scripts
- Node.js version incompatibility

**Solutions**:
```bash
# If you get dependency errors, try:
npm install --legacy-peer-deps

# Or force resolution:
npm install --force
```

### Issue 3: Port Already in Use
**Symptoms**: `EADDRINUSE` errors <mcreference link="https://station.railway.com/questions/issues-deploying-node-js-application-to-ea5ea64f" index="3">3</mcreference>

**Solution**: ✅ Fixed - using Railway's `PORT` environment variable

## 🚀 Deployment Steps (Updated)

### Step 1: Commit Your Changes
```bash
git add .
git commit -m "Fix Railway deployment configuration"
git push origin main
```

### Step 2: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Railway will auto-detect Node.js and use your `railway.toml`

### Step 3: Monitor Deployment
1. Check build logs in Railway dashboard
2. Verify health check at `/api/health`
3. Test your app URL

## 🛠️ Debugging Commands

### Check Local Build
```bash
# Test production build locally
npm run build
NODE_ENV=production PORT=3001 node server.js
```

### Test Health Endpoint
```bash
# Test locally
curl http://localhost:3001/api/health

# Test on Railway (replace with your URL)
curl https://your-app.railway.app/api/health
```

## 📋 Pre-Deployment Checklist

- ✅ Server listens on `0.0.0.0` and `process.env.PORT`
- ✅ `railway.toml` configuration exists
- ✅ `package.json` has correct start script
- ✅ Health check endpoint works
- ✅ Build command works locally
- ✅ All dependencies are in `package.json`

## 🔧 Environment Variables for Railway

Set these in Railway dashboard:

### Required:
- `NODE_ENV` = `production` (auto-set by Railway)
- `PORT` = (auto-set by Railway)

### Optional (for CORS):
- `ALLOWED_ORIGINS` = `https://your-vercel-app.vercel.app`

## 🚨 If Deployment Still Fails

### 1. Check Railway Logs
- Go to Railway dashboard
- Click on your service
- Check "Deployments" tab for error logs

### 2. Common Error Messages

**"Application failed to respond"**
- ✅ Fixed: Server now binds to `0.0.0.0`

**"Build failed"**
- Check if all dependencies are installed
- Verify Node.js version compatibility
- Try `npm install --legacy-peer-deps`

**"Port already in use"**
- ✅ Fixed: Using Railway's PORT variable

### 3. Test Locally First
```bash
# Simulate Railway environment
export NODE_ENV=production
export PORT=3001
npm run build
node server.js
```

## 📞 Getting Help

If you're still having issues:

1. **Check Railway Status**: [status.railway.app](https://status.railway.app)
2. **Railway Help Station**: [station.railway.com](https://station.railway.com)
3. **Railway Discord**: Join their community

## 🎯 Next Steps

1. **Redeploy**: Push your changes and redeploy
2. **Test**: Verify your app works on Railway
3. **Configure Vercel**: Update frontend with Railway URL
4. **Set CORS**: Add Vercel URL to Railway environment

Your deployment should now work! The main issue was the host binding, which is now fixed. 🚀