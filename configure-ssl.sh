#!/bin/bash

# Configure SSL for Nginx
echo "Configuring SSL for Nginx..."

# Move certificates to proper locations
sudo mv /tmp/nginx-selfsigned.crt /etc/ssl/certs/
sudo mv /tmp/nginx-selfsigned.key /etc/ssl/private/

# Set proper permissions
sudo chmod 644 /etc/ssl/certs/nginx-selfsigned.crt
sudo chmod 600 /etc/ssl/private/nginx-selfsigned.key

# Update Nginx configuration
sudo cp /tmp/nginx-ssl-config.conf /etc/nginx/sites-available/media-harvest

# Test Nginx configuration
sudo nginx -t

# Reload Nginx if configuration is valid
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "SSL configuration applied successfully!"
    echo "HTTPS is now available at: https://57.129.63.234"
else
    echo "Nginx configuration test failed. Please check the configuration."
fi

# Check Nginx status
sudo systemctl status nginx --no-pager