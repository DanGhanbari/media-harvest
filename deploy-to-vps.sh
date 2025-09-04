#!/bin/bash

# VPS Deployment Script
# This script deploys the latest code to the VPS

echo "🚀 Starting VPS deployment..."

# Execute all commands via SSH
ssh daniel@57.129.63.234 << 'EOF'
  # Navigate to application directory
  cd /var/www/downloader/blob-to-local-main || {
    echo "❌ Failed to navigate to application directory"
    exit 1
  }
  
  echo "📁 Current directory: $(pwd)"
  
  # Pull latest changes from git
  echo "📥 Pulling latest changes..."
  git pull origin main || {
    echo "❌ Failed to pull latest changes"
    exit 1
  }
  
  # Install/update dependencies
  echo "📦 Installing dependencies..."
  npm install || {
    echo "❌ Failed to install dependencies"
    exit 1
  }
  
  # Restart the application with PM2
  echo "🔄 Restarting application..."
  pm2 restart downloader-backend || {
    echo "❌ Failed to restart application"
    exit 1
  }
  
  # Show PM2 status
  echo "📊 Application status:"
  pm2 status
  
  echo "✅ Deployment completed successfully!"
EOF