# VPS Migration Guide - Media Downloader Backend

This guide will help you migrate your backend from Railway to a VPS while keeping the frontend on Vercel.

## Prerequisites

- A VPS with Ubuntu 20.04+ or Debian 11+
- Root or sudo access to the VPS
- A domain name pointing to your VPS (optional but recommended)
- Your GitHub repository URL

## Step 1: Prepare Your VPS Environment

### 1.1 Upload and Run the Setup Script

1. Copy the `vps-setup.sh` script to your VPS:
```bash
scp vps-setup.sh root@your-vps-ip:/root/
```

2. SSH into your VPS:
```bash
ssh root@your-vps-ip
```

3. Make the script executable and run it:
```bash
chmod +x vps-setup.sh
./vps-setup.sh
```

This script will install:
- Node.js 18.x (LTS)
- Python 3 and pip
- ffmpeg
- yt-dlp
- PM2 process manager
- Nginx web server
- Certbot for SSL
- UFW firewall
- Create `mediaapp` user

## Step 2: Deploy Your Backend Application

### 2.1 Switch to Application User

```bash
sudo su - mediaapp
```

### 2.2 Update Repository URL

Edit the `deploy-backend.sh` script and update the repository URL:
```bash
# In deploy-backend.sh, change this line:
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
# To your actual repository URL
```

### 2.3 Upload and Run Deployment Script

1. Copy the deployment script to your VPS:
```bash
# From your local machine
scp deploy-backend.sh mediaapp@your-vps-ip:/home/mediaapp/
```

2. Run the deployment script:
```bash
# On VPS as mediaapp user
chmod +x deploy-backend.sh
./deploy-backend.sh
```

### 2.4 Update Environment Configuration

Edit the `.env` file to match your setup:
```bash
cd /var/www/mediaapp
nano .env
```

Update these values:
```env
# Replace with your actual Vercel frontend URL
CORS_ORIGIN=https://your-frontend-app.vercel.app

# Optional: Add any custom configurations
```

## Step 3: Configure Nginx Reverse Proxy

### 3.1 Install Nginx Configuration

```bash
# Copy nginx config
sudo cp nginx-config.conf /etc/nginx/sites-available/mediaapp

# Update domain name in the config
sudo nano /etc/nginx/sites-available/mediaapp
# Replace 'your-domain.com' with your actual domain
# Replace 'your-frontend-app.vercel.app' with your Vercel URL

# Enable the site
sudo ln -s /etc/nginx/sites-available/mediaapp /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3.2 Set Up SSL Certificate (if using domain)

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 4: Update Frontend Configuration

### 4.1 Update Vercel Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to Environment Variables
3. Update `VITE_API_BASE_URL`:
   - If using domain: `https://your-domain.com`
   - If using IP: `http://your-vps-ip` (not recommended for production)

### 4.2 Update Local Development (Optional)

Update your local `.env.production` file:
```env
VITE_API_BASE_URL=https://your-domain.com
```

### 4.3 Redeploy Frontend

Trigger a new deployment on Vercel to pick up the new environment variables.

## Step 5: Testing and Verification

### 5.1 Test Backend Health

```bash
# Test locally on VPS
curl http://localhost:3001/api/health

# Test through Nginx (if using domain)
curl https://your-domain.com/api/health

# Test through Nginx (if using IP)
curl http://your-vps-ip/api/health
```

### 5.2 Test API Endpoints

```bash
# Test video info endpoint
curl -X POST https://your-domain.com/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Test download endpoint
curl -X POST https://your-domain.com/api/download-video \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":"720p"}'
```

### 5.3 Test Frontend Integration

1. Open your Vercel frontend URL
2. Try downloading a video from YouTube
3. Check browser developer tools for any CORS errors
4. Verify WebSocket connections work

## Step 6: Monitoring and Maintenance

### 6.1 Monitor Application

```bash
# View PM2 status
pm2 status

# View application logs
pm2 logs mediaapp-backend

# Monitor in real-time
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/mediaapp_access.log
sudo tail -f /var/log/nginx/mediaapp_error.log
```

### 6.2 Useful Commands

```bash
# Restart application
pm2 restart mediaapp-backend

# Stop application
pm2 stop mediaapp-backend

# Reload Nginx
sudo systemctl reload nginx

# Check firewall status
sudo ufw status

# Update yt-dlp
pip3 install --upgrade yt-dlp
```

## Step 7: Cleanup Railway Deployment (Optional)

Once everything is working on your VPS:

1. Update any external services pointing to Railway
2. Download any important logs from Railway
3. Delete the Railway deployment to avoid charges

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check `CORS_ORIGIN` in `.env` and Nginx config
2. **502 Bad Gateway**: Check if PM2 process is running (`pm2 status`)
3. **SSL Issues**: Verify Certbot certificate installation
4. **YouTube Downloads Failing**: Check yt-dlp version and logs
5. **High Memory Usage**: Monitor with `pm2 monit` and adjust PM2 config

### Log Locations

- Application logs: `/var/www/mediaapp/logs/`
- Nginx logs: `/var/log/nginx/`
- PM2 logs: `~/.pm2/logs/`
- System logs: `/var/log/syslog`

### Performance Optimization

1. **Increase PM2 instances** (if you have multiple CPU cores):
   ```javascript
   // In ecosystem.config.js
   instances: 'max', // or specific number
   exec_mode: 'cluster'
   ```

2. **Enable Nginx caching** for static responses
3. **Monitor resource usage** with `htop` and `pm2 monit`
4. **Set up log rotation** to prevent disk space issues

## Security Considerations

1. **Keep system updated**: `sudo apt update && sudo apt upgrade`
2. **Monitor failed login attempts**: `sudo tail /var/log/auth.log`
3. **Regular backups**: Set up automated backups of your application
4. **Firewall rules**: Only open necessary ports
5. **SSL certificate renewal**: Ensure Certbot auto-renewal is working

## Success Indicators

✅ VPS setup script completes without errors  
✅ Backend application starts with PM2  
✅ Nginx serves API requests  
✅ SSL certificate is installed (if using domain)  
✅ Frontend can communicate with backend  
✅ YouTube downloads work without cookie errors  
✅ WebSocket connections are stable  
✅ No CORS errors in browser console  

Congratulations! Your backend is now successfully running on your VPS with full control over the environment and better YouTube compatibility.