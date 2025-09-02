#!/bin/bash

# VPS Deployment Script
# This script should be run on the VPS to update the application

echo "🚀 Starting VPS deployment..."

# Navigate to application directory
cd /home/mediauser/media-harvest || {
    echo "❌ Failed to navigate to application directory"
    exit 1
}

# Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git pull origin main || {
    echo "❌ Failed to pull changes from GitHub"
    exit 1
}

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install || {
    echo "❌ Failed to install dependencies"
    exit 1
}

# Restart the application with PM2
echo "🔄 Restarting application..."
pm2 restart media-harvest || {
    echo "❌ Failed to restart application"
    exit 1
}

# Check application status
echo "✅ Checking application status..."
pm2 status media-harvest

echo "🎉 Deployment completed successfully!"
echo "📊 Application logs:"
pm2 logs media-harvest --lines 10