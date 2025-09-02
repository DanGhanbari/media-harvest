#!/bin/bash

# VPS Setup Script for Media Downloader Backend Migration
# Run this script on your VPS as root or with sudo privileges

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running with sudo privileges
check_privileges() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. This is acceptable for initial setup."
        SUDO_CMD=""
    elif sudo -n true 2>/dev/null; then
        log_info "Running with sudo privileges as user: $(whoami)"
        SUDO_CMD="sudo"
    else
        log_error "This script needs to be run with sudo privileges."
        log_info "Please run: sudo $0"
        exit 1
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    $SUDO_CMD apt update && $SUDO_CMD apt upgrade -y
    log_success "System packages updated"
}

# Install Node.js (using NodeSource repository for latest LTS)
install_nodejs() {
    log_info "Installing Node.js..."
    
    # Install Node.js 18.x (LTS)
    curl -fsSL https://deb.nodesource.com/setup_18.x | $SUDO_CMD bash -
    $SUDO_CMD apt-get install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    log_success "Node.js installed: $NODE_VERSION"
    log_success "npm installed: $NPM_VERSION"
}

# Install Python and pip
install_python() {
    log_info "Installing Python3 and pip..."
    
    $SUDO_CMD apt-get install -y python3 python3-pip python3-venv
    
    # Verify installation
    PYTHON_VERSION=$(python3 --version)
    PIP_VERSION=$(pip3 --version)
    
    log_success "Python installed: $PYTHON_VERSION"
    log_success "pip installed: $PIP_VERSION"
}

# Install ffmpeg
install_ffmpeg() {
    log_info "Installing ffmpeg..."
    
    $SUDO_CMD apt-get install -y ffmpeg
    
    # Verify installation
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    
    log_success "ffmpeg installed: $FFMPEG_VERSION"
}

# Install yt-dlp
install_ytdlp() {
    log_info "Installing yt-dlp..."
    
    # Try system package first
    if $SUDO_CMD apt-get install -y yt-dlp 2>/dev/null; then
        log_info "yt-dlp installed via system package"
    else
        # Fallback to pipx or user install
        if command -v pipx >/dev/null 2>&1; then
            pipx install yt-dlp
            log_info "yt-dlp installed via pipx"
        else
            # Install pipx first, then yt-dlp
            $SUDO_CMD apt-get install -y pipx
            pipx install yt-dlp
            # Ensure pipx binaries are in PATH
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            export PATH="$HOME/.local/bin:$PATH"
            log_info "yt-dlp installed via pipx (newly installed)"
        fi
    fi
    
    # Verify installation
    if command -v yt-dlp >/dev/null 2>&1; then
        YTDLP_VERSION=$(yt-dlp --version)
        log_success "yt-dlp installed: $YTDLP_VERSION"
    else
        log_error "Failed to install yt-dlp"
        exit 1
    fi
}

# Install additional utilities
install_utilities() {
    log_info "Installing additional utilities..."
    
    $SUDO_CMD apt-get install -y curl wget git unzip htop nano vim ufw
    
    log_success "Additional utilities installed"
}

# Install PM2 globally
install_pm2() {
    log_info "Installing PM2 process manager..."
    
    $SUDO_CMD npm install -g pm2
    
    # Verify installation
    PM2_VERSION=$(pm2 --version)
    
    log_success "PM2 installed: $PM2_VERSION"
}

# Install Nginx
install_nginx() {
    log_info "Installing Nginx..."
    
    $SUDO_CMD apt-get install -y nginx
    
    # Enable and start nginx
    $SUDO_CMD systemctl enable nginx
    $SUDO_CMD systemctl start nginx
    
    log_success "Nginx installed and started"
}

# Install Certbot for SSL
install_certbot() {
    log_info "Installing Certbot for SSL certificates..."
    
    $SUDO_CMD apt-get install -y certbot python3-certbot-nginx
    
    log_success "Certbot installed"
}

# Create application directory
create_app_directory() {
    log_info "Creating application directory..."
    
    # Create application directory
    $SUDO_CMD mkdir -p /var/www/downloader
    $SUDO_CMD chown $(whoami):$(whoami) /var/www/downloader
    
    log_success "Application directory created at /var/www/downloader"
}

# Configure basic firewall
setup_firewall() {
    log_info "Setting up basic firewall rules..."
    
    # Reset UFW to defaults
    $SUDO_CMD ufw --force reset
    
    # Set default policies
    $SUDO_CMD ufw default deny incoming
    $SUDO_CMD ufw default allow outgoing
    
    # Allow SSH (adjust port if needed)
    $SUDO_CMD ufw allow ssh
    
    # Allow HTTP and HTTPS
    $SUDO_CMD ufw allow 80/tcp
    $SUDO_CMD ufw allow 443/tcp
    
    # Enable firewall
    $SUDO_CMD ufw --force enable
    
    log_success "Firewall configured and enabled"
}

# Display summary
show_summary() {
    echo ""
    echo "======================================"
    log_success "VPS Setup Complete!"
    echo "======================================"
    echo ""
    echo "Installed components:"
    echo "  ✓ Node.js: $(node --version)"
    echo "  ✓ npm: $(npm --version)"
    echo "  ✓ Python: $(python3 --version)"
    echo "  ✓ pip: $(pip3 --version | cut -d' ' -f2)"
    echo "  ✓ ffmpeg: $(ffmpeg -version | head -n1 | cut -d' ' -f3)"
    echo "  ✓ yt-dlp: $(yt-dlp --version)"
    echo "  ✓ PM2: $(pm2 --version)"
    echo "  ✓ Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"
    echo "  ✓ Certbot: $(certbot --version | cut -d' ' -f2)"
    echo ""
    echo "Next steps:"
    echo "  1. Upload and run deploy-backend.sh script"
    echo "  2. Clone your repository to /var/www/downloader"
    echo "  3. Install npm dependencies"
    echo "  4. Configure environment variables"
    echo "  5. Set up Nginx reverse proxy"
    echo "  6. Configure SSL with Certbot"
    echo ""
}

# Main execution
main() {
    log_info "Starting VPS setup for Media Downloader backend..."
    
    check_privileges
    update_system
    install_utilities
    install_nodejs
    install_python
    install_ffmpeg
    install_ytdlp
    install_pm2
    install_nginx
    install_certbot
    create_app_directory
    setup_firewall
    
    show_summary
}

# Run main function
main "$@"