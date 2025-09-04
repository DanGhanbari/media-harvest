#!/bin/bash

# VPS Firewall Configuration Script
# This script helps configure firewall settings to allow HTTP/HTTPS traffic

echo "=== VPS Firewall Configuration ==="
echo "This script will help you configure firewall settings for ports 80 and 443"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo privileges"
    echo "Usage: sudo bash configure-firewall.sh"
    exit 1
fi

echo "1. Checking current UFW status..."
ufw status
echo ""

echo "2. Allowing HTTP traffic (port 80)..."
ufw allow 80/tcp
echo "✓ Port 80 (HTTP) allowed"
echo ""

echo "3. Allowing HTTPS traffic (port 443)..."
ufw allow 443/tcp
echo "✓ Port 443 (HTTPS) allowed"
echo ""

echo "4. Allowing SSH (port 22) - ensuring you don't get locked out..."
ufw allow 22/tcp
echo "✓ Port 22 (SSH) allowed"
echo ""

echo "5. Enabling UFW firewall..."
ufw --force enable
echo "✓ UFW firewall enabled"
echo ""

echo "6. Checking final UFW status..."
ufw status verbose
echo ""

echo "=== UFW Configuration Complete ==="
echo ""
echo "⚠️  IMPORTANT: Cloud Provider Firewall Configuration Required"
echo ""
echo "You also need to configure your cloud provider's firewall:"
echo ""
echo "For DigitalOcean:"
echo "1. Go to: https://cloud.digitalocean.com/networking/firewalls"
echo "2. Create or edit firewall rules"
echo "3. Add inbound rules:"
echo "   - HTTP: Port 80, Protocol TCP, Sources: All IPv4, All IPv6"
echo "   - HTTPS: Port 443, Protocol TCP, Sources: All IPv4, All IPv6"
echo "   - SSH: Port 22, Protocol TCP, Sources: All IPv4, All IPv6"
echo ""
echo "For AWS:"
echo "1. Go to EC2 Console > Security Groups"
echo "2. Edit inbound rules for your instance's security group"
echo "3. Add rules for ports 22, 80, and 443 with source 0.0.0.0/0"
echo ""
echo "For Google Cloud:"
echo "1. Go to VPC Network > Firewall"
echo "2. Create firewall rules for HTTP (80) and HTTPS (443)"
echo "3. Set direction: Ingress, Action: Allow, Targets: All instances"
echo ""
echo "After configuring both UFW and cloud provider firewall:"
echo "Test with: curl -v http://57.129.63.234/api/health"
echo ""
echo "=== Configuration Complete ==="