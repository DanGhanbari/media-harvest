#!/bin/bash

# Backend Deployment Script for VPS
# Run this script as your admin user (non-root) on your VPS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/downloader/blob-to-local-main/blob-to-local-main"
REPO_URL="https://github.com/DanGhanbari/downloader.git"  # Updated with actual repo URL
APP_NAME="downloader-backend"
PORT="3001"

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

# Check if running as correct user (non-root)
check_user() {
    if [[ $(whoami) == "root" ]]; then
        log_error "This script should not be run as root user."
        log_info "Run as your admin user (non-root) instead."
        exit 1
    fi
    log_info "Running as user: $(whoami)"
}

# Create application directory
create_app_directory() {
    log_info "Creating application directory..."
    
    # Create directory with sudo if it doesn't exist
    if [ ! -d "$APP_DIR" ]; then
        sudo mkdir -p $APP_DIR
        sudo chown $(whoami):$(whoami) $APP_DIR
        log_success "Application directory created at $APP_DIR"
    else
        log_info "Application directory already exists"
    fi
}

# Clone or update repository
setup_repository() {
    log_info "Setting up repository..."
    
    if [ -d "$APP_DIR/.git" ]; then
        log_info "Repository exists, pulling latest changes..."
        cd $APP_DIR
        git fetch origin
        git pull origin main
    elif [ -d "$APP_DIR" ]; then
        log_warning "Directory exists but is not a git repository. Removing and re-cloning..."
        rm -rf $APP_DIR
        log_info "Cloning repository..."
        log_warning "Note: GitHub requires authentication. Options:"
        log_warning "1. Use SSH: git clone git@github.com:DanGhanbari/downloader.git"
        log_warning "2. Use Personal Access Token with HTTPS"
        log_warning "3. Make repository public for anonymous access"
        
        # Try to clone, will prompt for authentication if needed
        if git clone $REPO_URL $APP_DIR; then
            log_success "Repository cloned successfully"
        else
            log_error "Failed to clone repository. Please check authentication."
            log_info "To use SSH instead, run: git clone git@github.com:DanGhanbari/downloader.git $APP_DIR"
            exit 1
        fi
        cd $APP_DIR
    else
        log_info "Cloning repository..."
        log_warning "Note: GitHub requires authentication. Options:"
        log_warning "1. Use SSH: git clone git@github.com:DanGhanbari/downloader.git"
        log_warning "2. Use Personal Access Token with HTTPS"
        log_warning "3. Make repository public for anonymous access"
        
        # Try to clone, will prompt for authentication if needed
        if git clone $REPO_URL $APP_DIR; then
            log_success "Repository cloned successfully"
        else
            log_error "Failed to clone repository. Please check authentication."
            log_info "To use SSH instead, run: git clone git@github.com:DanGhanbari/downloader.git $APP_DIR"
            exit 1
        fi
        cd $APP_DIR
    fi
    
    log_success "Repository setup complete"
}

# Install dependencies
install_dependencies() {
    log_info "Installing npm dependencies..."
    
    cd $APP_DIR
    npm install --production
    
    log_success "Dependencies installed"
}

# Create environment file
create_env_file() {
    log_info "Creating environment configuration..."
    
    cd $APP_DIR
    
    # Create .env file for backend-only mode
    cat > .env << EOF
# Backend-only configuration for VPS deployment
BACKEND_ONLY=true
PORT=$PORT
NODE_ENV=production

# CORS configuration - Update with your Vercel frontend URL
CORS_ORIGIN=https://your-frontend-app.vercel.app

# WebSocket configuration
WS_PORT=$PORT

# File upload configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=500MB

# Download configuration
DOWNLOAD_DIR=./downloads
MAX_CONCURRENT_DOWNLOADS=3

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Add your custom configurations here
# CUSTOM_CONFIG=value
EOF
    
    log_success "Environment file created"
    log_warning "Please update CORS_ORIGIN in .env with your actual Vercel frontend URL"
}

# Create PM2 ecosystem file
create_pm2_config() {
    log_info "Creating PM2 configuration..."
    
    cd $APP_DIR
    
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'downloader-backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: [
      'node_modules',
      'uploads',
      'downloads',
      'logs'
    ],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    log_success "PM2 configuration created"
}

# Create necessary directories
create_directories() {
    log_info "Creating application directories..."
    
    cd $APP_DIR
    
    # Create required directories
    mkdir -p uploads downloads logs temp
    
    # Set proper permissions
    chmod 755 uploads downloads logs temp
    
    log_success "Application directories created"
}

# Start application with PM2
start_application() {
    log_info "Starting application with PM2..."
    
    cd $APP_DIR
    
    # Stop existing process if running
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start application
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $HOME
    
    log_success "Application started with PM2"
}

# Test application
test_application() {
    log_info "Testing application..."
    
    # Wait for application to start
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:$PORT/api/health > /dev/null 2>&1; then
        log_success "Application is responding on port $PORT"
    else
        log_warning "Application may not be responding. Check PM2 logs: pm2 logs"
    fi
    
    # Show PM2 status
    pm2 status
}

# Display next steps
show_next_steps() {
    echo ""
    echo "======================================"
    log_success "Backend Deployment Complete!"
    echo "======================================"
    echo ""
    echo "Application Status:"
    echo "  • Running on: http://localhost:$PORT"
    echo "  • PM2 Process: $APP_NAME"
    echo "  • Logs: $APP_DIR/logs/"
    echo ""
    echo "Next Steps:"
    echo "  1. Update CORS_ORIGIN in .env file with your Vercel frontend URL"
    echo "  2. Configure Nginx reverse proxy (see nginx-config.conf)"
    echo "  3. Set up SSL certificate with Certbot"
    echo "  4. Update Vercel frontend to point to your VPS"
    echo "  5. Test all API endpoints"
    echo ""
    echo "Useful Commands:"
    echo "  • View logs: pm2 logs $APP_NAME"
    echo "  • Restart app: pm2 restart $APP_NAME"
    echo "  • Stop app: pm2 stop $APP_NAME"
    echo "  • Monitor: pm2 monit"
    echo ""
}

# Main execution
main() {
    log_info "Starting backend deployment..."
    
    check_user
    create_app_directory
    setup_repository
    install_dependencies
    create_env_file
    create_pm2_config
    create_directories
    start_application
    test_application
    
    show_next_steps
}

# Run main function
main "$@"