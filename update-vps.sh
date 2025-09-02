#!/bin/bash

# Quick VPS Update Script
# Updates the VPS backend with latest code including video-info endpoint

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="57.129.63.234"
VPS_USER="daniel"  # Change this to your VPS username
APP_DIR="/var/www/downloader/blob-to-local-main"
APP_NAME="downloader-backend"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Update VPS backend
update_vps() {
    log_info "Updating VPS backend with latest code..."
    
    # SSH into VPS and update
    ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
        set -e
        
        echo "[INFO] Navigating to application directory..."
        cd /var/www/downloader/blob-to-local-main
        
        echo "[INFO] Pulling latest changes from repository..."
        git fetch origin
        git pull origin main
        
        echo "[INFO] Installing/updating dependencies..."
        npm install --production
        
        echo "[INFO] Restarting application with PM2..."
        pm2 restart downloader-backend
        
        echo "[INFO] Checking application status..."
        sleep 3
        pm2 status
        
        echo "[INFO] Testing health endpoint..."
        curl -f http://localhost:3001/api/health || echo "[WARNING] Health check failed"
        
        echo "[SUCCESS] VPS backend updated successfully!"
ENDSSH
    
    if [ $? -eq 0 ]; then
        log_success "VPS backend updated successfully!"
        log_info "Testing video-info endpoint..."
        
        # Test the video-info endpoint
        sleep 5
        if curl -X POST -H "Content-Type: application/json" -d '{"url":"https://youtu.be/lzN1FOSk6N4?si=_USe3uFDdZJToX31"}' http://$VPS_HOST:3001/api/video-info; then
            log_success "video-info endpoint is now working!"
        else
            log_warning "video-info endpoint test failed - may need manual verification"
        fi
    else
        log_error "Failed to update VPS backend"
        exit 1
    fi
}

# Main execution
main() {
    log_info "Starting VPS backend update..."
    
    # Check if we can reach the VPS
    if ! ping -c 1 $VPS_HOST > /dev/null 2>&1; then
        log_error "Cannot reach VPS at $VPS_HOST"
        exit 1
    fi
    
    update_vps
    
    log_success "VPS update complete!"
    echo ""
    echo "The VPS backend now includes the video-info endpoint."
    echo "You can test it at: http://$VPS_HOST:3001/api/video-info"
}

# Run main function
main "$@"