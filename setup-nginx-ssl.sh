#!/bin/bash

# Setup Nginx with SSL/TLS on VPS
echo "Setting up Nginx with SSL/TLS..."

# Update package list
sudo apt update

# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Check if Nginx is running
sudo systemctl status nginx --no-pager

# Create Nginx configuration for the backend
sudo tee /etc/nginx/sites-available/media-harvest > /dev/null <<EOF
server {
    listen 80;
    server_name 57.129.63.234;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/media-harvest /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

echo "Nginx setup complete. Ready for SSL certificate installation."
echo "Next step: Run 'sudo certbot --nginx -d 57.129.63.234' to get SSL certificate"