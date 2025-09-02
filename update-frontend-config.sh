#!/bin/bash

# Frontend Configuration Update Script
# Run this script locally to update your frontend to point to the VPS backend

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

# Get VPS backend URL from user
get_backend_url() {
    echo ""
    log_info "Please enter your VPS backend URL:"
    echo "  Examples:"
    echo "    - https://api.yourdomain.com (recommended)"
    echo "    - http://your-vps-ip (for testing only)"
    echo ""
    read -p "Backend URL: " BACKEND_URL
    
    # Remove trailing slash if present
    BACKEND_URL=${BACKEND_URL%/}
    
    # Validate URL format
    if [[ ! $BACKEND_URL =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]]; then
        log_error "Invalid URL format. Please use http:// or https://"
        exit 1
    fi
    
    log_success "Backend URL set to: $BACKEND_URL"
}

# Update .env.production file
update_env_production() {
    log_info "Updating .env.production file..."
    
    # Create or update .env.production
    cat > .env.production << EOF
# Production environment configuration
# Updated for VPS backend deployment

# Backend API URL - Points to your VPS
VITE_API_BASE_URL=$BACKEND_URL

# Build configuration
VITE_NODE_ENV=production

# Optional: Add any other production-specific variables
EOF
    
    log_success ".env.production updated"
}

# Update vercel.json for API rewrites
update_vercel_config() {
    log_info "Updating vercel.json configuration..."
    
    # Check if vercel.json exists
    if [ ! -f "vercel.json" ]; then
        log_warning "vercel.json not found, creating new one..."
    fi
    
    # Create updated vercel.json
    cat > vercel.json << EOF
{
  "buildCommand": "npm run build:prod",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "$BACKEND_URL/api/\$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "env": {
    "VITE_API_BASE_URL": "$BACKEND_URL"
  }
}
EOF
    
    log_success "vercel.json updated"
}

# Update local development environment (optional)
update_env_local() {
    log_info "Do you want to update .env.local for local development? (y/n)"
    read -p "Update .env.local? " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat > .env.local << EOF
# Local development environment
# Points to VPS backend for testing

VITE_API_BASE_URL=$BACKEND_URL

# Development specific settings
VITE_NODE_ENV=development
EOF
        log_success ".env.local updated"
    else
        log_info "Skipping .env.local update"
    fi
}

# Test backend connectivity
test_backend_connection() {
    log_info "Testing backend connectivity..."
    
    # Test health endpoint
    if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
        log_success "Backend is responding at $BACKEND_URL"
    else
        log_warning "Backend may not be responding. Please verify:"
        echo "  1. VPS backend is running (pm2 status)"
        echo "  2. Nginx is configured correctly"
        echo "  3. Firewall allows HTTP/HTTPS traffic"
        echo "  4. Domain DNS is pointing to VPS IP"
    fi
}

# Show deployment instructions
show_deployment_instructions() {
    echo ""
    echo "======================================"
    log_success "Frontend Configuration Updated!"
    echo "======================================"
    echo ""
    echo "Files updated:"
    echo "  ✓ .env.production"
    echo "  ✓ vercel.json"
    if [ -f ".env.local" ]; then
        echo "  ✓ .env.local"
    fi
    echo ""
    echo "Next Steps:"
    echo "  1. Commit and push changes to your repository"
    echo "  2. Deploy to Vercel (automatic if connected to Git)"
    echo "  3. Or manually deploy: vercel --prod"
    echo ""
    echo "Verification:"
    echo "  1. Open your Vercel app URL"
    echo "  2. Check browser console for errors"
    echo "  3. Test video download functionality"
    echo "  4. Verify WebSocket connections work"
    echo ""
    echo "Troubleshooting:"
    echo "  • CORS errors: Check VPS backend CORS_ORIGIN setting"
    echo "  • API errors: Verify backend is running on VPS"
    echo "  • SSL errors: Ensure SSL certificate is properly configured"
    echo ""
}

# Main execution
main() {
    log_info "Starting frontend configuration update..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script from your project root."
        exit 1
    fi
    
    get_backend_url
    update_env_production
    update_vercel_config
    update_env_local
    test_backend_connection
    
    show_deployment_instructions
}

# Run main function
main "$@"