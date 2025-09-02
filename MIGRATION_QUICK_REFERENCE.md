# VPS Migration Quick Reference

A quick reference guide for migrating your Media Downloader backend to VPS.

## 🚀 Quick Start Commands

### 1. VPS Initial Setup (as root)
```bash
# Upload and run setup script
scp vps-setup.sh root@YOUR_VPS_IP:/root/
ssh root@YOUR_VPS_IP
chmod +x vps-setup.sh
./vps-setup.sh
```

### 2. Deploy Backend (as mediaapp user)
```bash
# Switch to app user
sudo su - mediaapp

# Update deploy script with your repo URL
# Edit REPO_URL in deploy-backend.sh

# Run deployment
chmod +x deploy-backend.sh
./deploy-backend.sh

# Update CORS settings
cd /var/www/mediaapp
nano .env  # Update CORS_ORIGIN
```

### 3. Configure Nginx (as root)
```bash
# Install nginx config
sudo cp nginx-config.conf /etc/nginx/sites-available/mediaapp
sudo nano /etc/nginx/sites-available/mediaapp  # Update domain
sudo ln -s /etc/nginx/sites-available/mediaapp /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL (if using domain)
sudo certbot --nginx -d yourdomain.com
```

### 4. Update Frontend (locally)
```bash
# Run frontend update script
chmod +x update-frontend-config.sh
./update-frontend-config.sh

# Commit and deploy
git add .
git commit -m "Update frontend to use VPS backend"
git push
```

## 📋 Essential Files Created

| File | Purpose | Location |
|------|---------|----------|
| `vps-setup.sh` | VPS environment setup | Run on VPS as root |
| `deploy-backend.sh` | Backend deployment | Run on VPS as mediaapp |
| `nginx-config.conf` | Nginx reverse proxy | Copy to `/etc/nginx/sites-available/` |
| `update-frontend-config.sh` | Frontend configuration | Run locally |
| `VPS_MIGRATION_GUIDE.md` | Detailed guide | Reference |

## 🔧 Key Configuration Updates

### Backend (.env on VPS)
```env
BACKEND_ONLY=true
CORS_ORIGIN=https://your-frontend-app.vercel.app
PORT=3001
NODE_ENV=production
```

### Frontend (.env.production locally)
```env
VITE_API_BASE_URL=https://your-domain.com
```

### Nginx (update these in nginx-config.conf)
```nginx
server_name your-domain.com www.your-domain.com;
add_header Access-Control-Allow-Origin "https://your-frontend-app.vercel.app";
```

## 🧪 Testing Commands

### Backend Health Check
```bash
# Local test on VPS
curl http://localhost:3001/api/health

# External test
curl https://your-domain.com/api/health
```

### API Endpoint Test
```bash
curl -X POST https://your-domain.com/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### PM2 Management
```bash
pm2 status                    # Check app status
pm2 logs mediaapp-backend     # View logs
pm2 restart mediaapp-backend  # Restart app
pm2 monit                     # Monitor resources
```

## 🔍 Troubleshooting

### Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| 502 Bad Gateway | `pm2 status` | `pm2 restart mediaapp-backend` |
| CORS Errors | `.env` CORS_ORIGIN | Update and restart PM2 |
| SSL Issues | Certificate | `sudo certbot renew` |
| YouTube Fails | yt-dlp version | `pip3 install --upgrade yt-dlp` |
| High Memory | `pm2 monit` | Adjust PM2 config |

### Log Locations
```bash
# Application logs
tail -f /var/www/mediaapp/logs/combined.log

# Nginx logs
sudo tail -f /var/log/nginx/mediaapp_error.log

# PM2 logs
pm2 logs mediaapp-backend
```

## 📊 Monitoring Commands

```bash
# System resources
htop
df -h          # Disk usage
free -h        # Memory usage

# Application monitoring
pm2 monit      # PM2 dashboard
pm2 status     # Process status

# Network
sudo netstat -tlnp | grep :3001  # Check port
sudo ufw status                   # Firewall status
```

## 🔄 Update Procedures

### Update Application Code
```bash
sudo su - mediaapp
cd /var/www/mediaapp
git pull origin main
npm install --production
pm2 restart mediaapp-backend
```

### Update System Dependencies
```bash
# Update yt-dlp
pip3 install --upgrade yt-dlp

# Update system packages
sudo apt update && sudo apt upgrade

# Update Node.js (if needed)
# Follow NodeSource instructions
```

## 🛡️ Security Checklist

- [ ] UFW firewall enabled
- [ ] SSH key authentication (disable password auth)
- [ ] SSL certificate installed
- [ ] Regular system updates scheduled
- [ ] Non-root user for application
- [ ] Nginx security headers configured
- [ ] Rate limiting enabled
- [ ] Log monitoring set up

## 📞 Emergency Commands

```bash
# Stop everything
pm2 stop all
sudo systemctl stop nginx

# Restart everything
pm2 restart all
sudo systemctl restart nginx

# Check what's using port 3001
sudo lsof -i :3001

# Kill process on port 3001
sudo kill -9 $(sudo lsof -t -i:3001)
```

## 🎯 Success Indicators

✅ `pm2 status` shows app running  
✅ `curl localhost:3001/api/health` returns 200  
✅ `curl https://yourdomain.com/api/health` returns 200  
✅ Frontend loads without CORS errors  
✅ YouTube downloads work  
✅ WebSocket connections stable  
✅ SSL certificate valid  

---

**Need help?** Refer to the detailed `VPS_MIGRATION_GUIDE.md` for step-by-step instructions.