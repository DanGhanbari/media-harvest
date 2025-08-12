#!/bin/bash

# Media Harvest Deployment Script
# This script helps you deploy to Vercel (frontend) and Railway (backend)

set -e  # Exit on any error

echo "🚀 Media Harvest Deployment Setup"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install Node.js and npm first."
        exit 1
    fi
    
    print_success "All dependencies are installed."
}

# Check if code is committed to git
check_git_status() {
    print_status "Checking git status..."
    
    if [ ! -d ".git" ]; then
        print_error "This is not a git repository. Please initialize git first:"
        echo "  git init"
        echo "  git add ."
        echo "  git commit -m 'Initial commit'"
        exit 1
    fi
    
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes. It's recommended to commit them first."
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_success "Git status is clean."
}

# Get Railway app URL from user
get_railway_url() {
    echo ""
    print_status "Railway Backend Configuration"
    echo "After deploying to Railway, you'll get a URL like: https://your-app-name.railway.app"
    echo ""
    read -p "Enter your Railway app URL (or press Enter to skip for now): " RAILWAY_URL
    
    if [ -n "$RAILWAY_URL" ]; then
        # Remove trailing slash if present
        RAILWAY_URL=${RAILWAY_URL%/}
        
        # Update .env.production
        print_status "Updating .env.production with Railway URL..."
        sed -i.bak "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$RAILWAY_URL|" .env.production
        
        # Update vercel.json
        print_status "Updating vercel.json with Railway URL..."
        sed -i.bak "s|https://your-railway-app.railway.app|$RAILWAY_URL|g" vercel.json
        
        print_success "Configuration files updated with Railway URL: $RAILWAY_URL"
    else
        print_warning "Railway URL not provided. You'll need to update it manually later."
    fi
}

# Build the project
build_project() {
    print_status "Building the project..."
    
    # Install dependencies
    npm install
    
    # Build for production
    npm run build
    
    print_success "Project built successfully."
}

# Show deployment instructions
show_deployment_instructions() {
    echo ""
    echo "📋 Deployment Instructions"
    echo "=========================="
    echo ""
    
    echo "🔧 Step 1: Deploy Backend to Railway"
    echo "   1. Go to https://railway.app"
    echo "   2. Sign up/login with GitHub"
    echo "   3. Click 'New Project' → 'Deploy from GitHub repo'"
    echo "   4. Select this repository"
    echo "   5. Railway will auto-detect Node.js and deploy"
    echo "   6. Copy your Railway app URL"
    echo ""
    
    echo "🌐 Step 2: Deploy Frontend to Vercel"
    echo "   1. Go to https://vercel.com"
    echo "   2. Sign up/login with GitHub"
    echo "   3. Click 'New Project' → Import your GitHub repository"
    echo "   4. Set these build settings:"
    echo "      - Framework Preset: Vite"
    echo "      - Build Command: npm run build"
    echo "      - Output Directory: dist"
    echo "   5. Add environment variable:"
    echo "      - VITE_API_BASE_URL = [Your Railway URL]"
    echo "   6. Click 'Deploy'"
    echo ""
    
    echo "⚙️  Step 3: Configure CORS"
    echo "   1. In Railway dashboard, add environment variable:"
    echo "      - ALLOWED_ORIGINS = [Your Vercel URL]"
    echo "   2. Redeploy if necessary"
    echo ""
    
    if [ -n "$RAILWAY_URL" ]; then
        echo "✅ Your configuration files have been updated with:"
        echo "   - Railway URL: $RAILWAY_URL"
        echo ""
    fi
    
    echo "📚 For detailed instructions, see: VERCEL_RAILWAY_DEPLOYMENT.md"
    echo ""
}

# Main execution
main() {
    check_dependencies
    check_git_status
    get_railway_url
    build_project
    show_deployment_instructions
    
    print_success "Setup complete! Follow the deployment instructions above."
}

# Run main function
main