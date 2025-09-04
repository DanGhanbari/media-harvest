# OVH VPS Firewall Configuration Guide

## Overview
OVH VPS instances use both UFW (Ubuntu Firewall) and OVH's cloud firewall. You need to configure both to allow external access.

## 1. UFW Configuration (Already Done)
✅ UFW has been configured with the `configure-firewall.sh` script to allow:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3001 (Backend)

## 2. OVH Cloud Firewall Configuration

### Method 1: OVH Control Panel (Recommended)
1. Log in to your OVH Control Panel: https://www.ovh.com/manager/
2. Navigate to "Public Cloud" → "Instances"
3. Select your VPS instance
4. Go to the "Security Groups" or "Firewall" tab
5. Create or edit security group rules:
   - **Rule 1**: Allow HTTP
     - Protocol: TCP
     - Port: 80
     - Source: 0.0.0.0/0 (anywhere)
   - **Rule 2**: Allow HTTPS
     - Protocol: TCP
     - Port: 443
     - Source: 0.0.0.0/0 (anywhere)
   - **Rule 3**: Allow SSH (if not already present)
     - Protocol: TCP
     - Port: 22
     - Source: 0.0.0.0/0 (anywhere) or your IP for security

### Method 2: OVH API (Advanced)
If you prefer using the OVH API, you can configure firewall rules programmatically.

### Method 3: OpenStack CLI (If using OpenStack)
```bash
# Install OpenStack CLI
pip install python-openstackclient

# Configure OpenStack credentials (get from OVH panel)
export OS_AUTH_URL=https://auth.cloud.ovh.net/v3
export OS_IDENTITY_API_VERSION=3
export OS_USER_DOMAIN_NAME="Default"
export OS_PROJECT_DOMAIN_NAME="Default"
export OS_TENANT_ID="your_tenant_id"
export OS_TENANT_NAME="your_tenant_name"
export OS_USERNAME="your_username"
export OS_PASSWORD="your_password"
export OS_REGION_NAME="your_region"

# Create security group rules
openstack security group rule create --protocol tcp --dst-port 80 --remote-ip 0.0.0.0/0 default
openstack security group rule create --protocol tcp --dst-port 443 --remote-ip 0.0.0.0/0 default
```

## 3. Verification Steps

After configuring the OVH firewall:

1. **Test external connectivity:**
   ```bash
   curl -v http://57.129.63.234/api/health
   ```

2. **Check if ports are open:**
   ```bash
   nmap -p 80,443 57.129.63.234
   ```

3. **Test from different locations:**
   - Use online tools like https://www.yougetsignal.com/tools/open-ports/
   - Test from your local machine
   - Test from another server

## 4. Common OVH Firewall Issues

### Issue: Default Security Group Blocks Traffic
- **Solution**: Ensure your instance is assigned to a security group with open ports
- **Check**: OVH Control Panel → Instances → Security Groups

### Issue: Network ACLs
- **Solution**: Some OVH regions use Network ACLs in addition to security groups
- **Check**: OVH Control Panel → Network → Network ACLs

### Issue: Anti-DDoS Protection
- **Solution**: OVH's anti-DDoS might block legitimate traffic
- **Check**: OVH Control Panel → Anti-DDoS settings
- **Action**: Whitelist your IP or adjust sensitivity

## 5. OVH-Specific Considerations

1. **Default Firewall**: OVH VPS instances often come with restrictive default firewall rules
2. **Regional Differences**: Firewall configuration may vary between OVH regions (GRA, SBG, BHS, etc.)
3. **Instance Types**: Different instance types (VPS, Public Cloud, Dedicated) have different firewall systems
4. **Network Configuration**: Ensure your instance has a public IP assigned

## 6. Emergency Access

If you lose SSH access after firewall changes:
1. Use OVH Control Panel → Console (VNC access)
2. Reset firewall rules:
   ```bash
   sudo ufw --force reset
   sudo ufw allow 22
   sudo ufw --force enable
   ```

## Next Steps

1. Configure OVH firewall using Method 1 (Control Panel)
2. Test connectivity with the verification commands
3. If still blocked, check anti-DDoS settings
4. Consider setting up domain DNS records once connectivity is confirmed

## Support Resources

- OVH Documentation: https://docs.ovh.com/
- OVH Community: https://community.ovh.com/
- OVH Support: Available through your control panel