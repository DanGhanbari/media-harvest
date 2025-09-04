# VPS Chrome Setup & YouTube Cookies Extraction Guide

This guide shows how to install Chrome on your VPS, log into your Google account, and extract cookies for yt-dlp authentication.

## Prerequisites
- VPS with Ubuntu/Debian
- SSH access to your VPS
- Your Google account credentials

## Step 1: Install Chrome on VPS

```bash
# Update system
sudo apt update

# Install dependencies
sudo apt install -y wget gnupg software-properties-common

# Add Google Chrome repository
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# Install Chrome
sudo apt update
sudo apt install -y google-chrome-stable

# Install Xvfb for headless display
sudo apt install -y xvfb
```

## Step 2: Set up Virtual Display

```bash
# Start virtual display
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99

# Or create a script to manage this
echo '#!/bin/bash
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
google-chrome --no-sandbox --disable-dev-shm-usage "$@"' | sudo tee /usr/local/bin/chrome-headless
sudo chmod +x /usr/local/bin/chrome-headless
```

## Step 3: Log into Your Google Account

### Option A: Using Chrome with VNC (Recommended)

1. Install VNC server:
```bash
sudo apt install -y tightvncserver
vncserver :1 -geometry 1024x768 -depth 24
```

2. Connect via VNC client and open Chrome:
```bash
google-chrome --no-sandbox
```

3. Navigate to YouTube and log into your Google account
4. Browse some YouTube videos to establish session

### Option B: Using SSH X11 Forwarding

1. SSH with X11 forwarding:
```bash
ssh -X your-user@your-vps-ip
```

2. Launch Chrome:
```bash
google-chrome --no-sandbox
```

## Step 4: Extract Cookies

### Method 1: Using Browser Extension (Easiest)

1. Install "Get cookies.txt" extension in Chrome
2. Navigate to YouTube
3. Click extension → Export cookies for youtube.com
4. Save as `cookies.txt`

### Method 2: Manual Cookie Extraction

```bash
# Find Chrome profile directory
find ~/.config/google-chrome -name "Cookies" -type f

# Use sqlite3 to extract cookies
sudo apt install -y sqlite3

# Extract YouTube cookies
sqlite3 ~/.config/google-chrome/Default/Cookies "SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%youtube%' OR host_key LIKE '%google%';" > raw_cookies.txt
```

### Method 3: Using yt-dlp's Built-in Extraction

```bash
# Extract cookies directly
yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Step 5: Set up Cookies for Your Application

1. Copy cookies.txt to your application directory:
```bash
cp cookies.txt /path/to/your/app/cookies.txt
chmod 600 /path/to/your/app/cookies.txt
```

2. Update your server.js to use cookies:
```javascript
// Add this to your yt-dlp arguments
const ytdlpArgs = [
    '--cookies', path.join(__dirname, 'cookies.txt'),
    // ... other arguments
];
```

## Step 6: Automate Cookie Refresh

Create a script to periodically refresh cookies:

```bash
#!/bin/bash
# refresh-cookies.sh

cd /path/to/your/app

# Backup old cookies
cp cookies.txt cookies.txt.backup

# Extract fresh cookies
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99

# Use yt-dlp to refresh cookies
yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Restart your application
pm2 restart your-app

echo "Cookies refreshed at $(date)"
```

Make it executable and add to crontab:
```bash
chmod +x refresh-cookies.sh

# Run weekly
echo "0 0 * * 0 /path/to/refresh-cookies.sh" | crontab -
```

## Step 7: Test the Setup

```bash
# Test with a YouTube video
yt-dlp --cookies cookies.txt --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Test your application
curl -X POST http://localhost:3001/api/video-info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Security Considerations

1. **Protect cookies.txt**:
   ```bash
   chmod 600 cookies.txt
   chown your-app-user:your-app-group cookies.txt
   ```

2. **Regular rotation**: Set up automatic cookie refresh
3. **Monitor for failures**: Log when cookie authentication fails
4. **Backup strategy**: Keep backup cookies in case of corruption

## Troubleshooting

### Chrome won't start
```bash
# Add these flags
google-chrome --no-sandbox --disable-dev-shm-usage --disable-gpu --remote-debugging-port=9222
```

### Cookies not working
```bash
# Check cookie format
head -5 cookies.txt

# Should start with:
# # Netscape HTTP Cookie File
```

### VNC connection issues
```bash
# Kill existing VNC sessions
vncserver -kill :1

# Restart with new geometry
vncserver :1 -geometry 1280x720 -depth 24
```

## Alternative: Using Selenium for Automation

For fully automated cookie extraction:

```python
# install_selenium_cookies.py
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import json
import time

def extract_youtube_cookies():
    options = Options()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=options)
    
    # Navigate to YouTube
    driver.get('https://www.youtube.com')
    
    # Manual login required here
    input("Please log into YouTube and press Enter...")
    
    # Extract cookies
    cookies = driver.get_cookies()
    
    # Convert to Netscape format
    with open('cookies.txt', 'w') as f:
        f.write('# Netscape HTTP Cookie File\n')
        for cookie in cookies:
            if 'youtube.com' in cookie['domain'] or 'google.com' in cookie['domain']:
                f.write(f"{cookie['domain']}\tTRUE\t{cookie['path']}\t{str(cookie['secure']).upper()}\t{cookie.get('expiry', 0)}\t{cookie['name']}\t{cookie['value']}\n")
    
    driver.quit()
    print("Cookies extracted to cookies.txt")

if __name__ == "__main__":
    extract_youtube_cookies()
```

This approach ensures your personal YouTube account cookies are used server-side without requiring users to provide their own authentication.