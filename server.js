// Advanced YouTube bypass system with multiple strategies
class YouTubeBypassManager {
  constructor() {
    this.sessionCache = new Map();
    this.proxyRotation = 0;
    this.clientRotation = 0;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.lastProxyRotation = 0;
    this.proxyFailures = new Map();
    this.cookieJar = null;

    // ENSURE NODE IS VISIBLE TO YT-DLP:
    // yt-dlp needs Node.js for JS interpretation (Solving n-sig, etc.)
    // We add the directory of the current node executable to PATH
    try {
      const nodeDir = path.dirname(process.execPath);
      const currentPath = process.env.PATH || '';
      if (!currentPath.includes(nodeDir)) {
        process.env.PATH = `${nodeDir}${path.delimiter}${currentPath}`;
        console.log(`🔧 Updated PATH for yt-dlp compatibility: Added Node dir ${nodeDir}`);
      }
    } catch (e) {
      console.error('Failed to update PATH for node runtime:', e);
    }

    // ENSURE DENO IS VISIBLE TO YT-DLP:
    // Support finding Deno even if not in standard PATH (common in Nix/Railway envs)
    try {
      // 1. Check if deno is already in PATH
      let denoPath = '';
      try {
        denoPath = execSync('which deno', { encoding: 'utf8' }).trim();
        console.log(`🔧 Deno found at: ${denoPath}`);
      } catch (e) {
        console.log('⚠️ Deno not found in initial PATH. Searching...');
      }

      // 2. If not found, try common locations
      if (!denoPath) {
        const home = os.homedir();
        const cwd = process.cwd();
        console.log(`🔍 Debug: Current User: ${os.userInfo().username}, Home: ${home}, CWD: ${cwd}`);

        const commonPaths = [
          path.join(cwd, 'deno', 'bin', 'deno'), // Visible local install (/app/deno)
          path.join(cwd, '.deno', 'bin', 'deno'), // Local install in project root (most reliable)
          path.join(home, '.deno', 'bin', 'deno'),
          '/usr/bin/deno',
          '/usr/local/bin/deno',
          '/nix/var/nix/profiles/default/bin/deno',
          '/root/.deno/bin/deno',
          '/home/railway/.deno/bin/deno'
        ];

        for (const p of commonPaths) {
          if (fs.existsSync(p)) {
            denoPath = p;
            console.log(`🔧 Found Deno at backup location: ${denoPath}`);
            // Add to PATH
            const deniedDir = path.dirname(p);
            process.env.PATH = `${deniedDir}${path.delimiter}${process.env.PATH}`;
            break;
          }
        }

        // 3. Fallback: Runtime Install (JIT) - "The Nuclear Option"
        // If build-time install failed, we download it now to /tmp (always writable)
        if (!denoPath) {
          console.log('⚠️ Deno not found in filesystem. Attempting Runtime JIT Installation...');
          try {
            // Use /tmp/deno_jit to avoid any perm issues with /app
            const installDir = path.join(os.tmpdir(), 'deno_jit');
            const denoBin = path.join(installDir, 'bin', 'deno');

            // Clean/Fresh install if needed
            if (!fs.existsSync(denoBin)) {
              console.log(`⬇️ Downloading Deno to ${installDir}...`);
              // Force install to tmp
              execSync(`curl -fsSL https://deno.land/install.sh | DENO_INSTALL="${installDir}" sh`, {
                stdio: 'inherit',
                env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
              });
            }

            if (fs.existsSync(denoBin)) {
              denoPath = denoBin;
              console.log(`✅ Runtime Deno Install Successful at: ${denoPath}`);
              // Add to PATH
              const binDir = path.dirname(denoBin);
              process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
            } else {
              console.error('❌ Runtime install completed but binary is missing.');
            }
          } catch (e) {
            console.error('❌ Runtime Deno Install Failed:', e);
          }
        }

        // Final Check
        if (!denoPath) {
          console.error('❌ CRITICAL: Deno executable NOT found! yt-dlp authentication will explicitly FAIL.');
          console.error('Current PATH:', process.env.PATH);
        }
      }
    } catch (e) {
      console.error('Failed to update PATH for Deno runtime:', e);
    }

    this.initializeCookieJar();
    this.initializeProxySystem();
  }

  async initializeProxySystem() {
    console.log('🌐 Initializing enhanced proxy rotation system...');

    // Count available proxies by region
    const proxyRegions = {
      'US': [process.env.US_PROXY_1, process.env.US_PROXY_2, process.env.US_PROXY_3].filter(Boolean).length,
      'EU': [process.env.EU_PROXY_1, process.env.EU_PROXY_2, process.env.EU_PROXY_3].filter(Boolean).length,
      'APAC': [process.env.APAC_PROXY_1, process.env.APAC_PROXY_2, process.env.APAC_PROXY_3].filter(Boolean).length,
      'Basic': [process.env.HTTP_PROXY, process.env.HTTPS_PROXY, process.env.SOCKS_PROXY].filter(Boolean).length
    };

    const totalProxies = Object.values(proxyRegions).reduce((sum, count) => sum + count, 0);

    if (totalProxies > 0) {
      console.log('🌐 Proxy configuration detected:');
      Object.entries(proxyRegions).forEach(([region, count]) => {
        if (count > 0) {
          console.log(`  ${region}: ${count} proxy(ies)`);
        }
      });
      console.log(`  Total: ${totalProxies} proxy(ies) available for rotation`);
    } else {
      console.log('⚠️ No proxies configured. YouTube access may be limited.');
      console.log('💡 To enable proxy rotation, set environment variables:');
      console.log('   US_PROXY_1, US_PROXY_2, US_PROXY_3 (US region)');
      console.log('   EU_PROXY_1, EU_PROXY_2, EU_PROXY_3 (EU region)');
      console.log('   APAC_PROXY_1, APAC_PROXY_2, APAC_PROXY_3 (Asia-Pacific region)');
    }
  }

  async initializeCookieJar() {
    // Create persistent cookie storage
    const cookieDir = path.join(process.cwd(), '.cookies');
    if (!fs.existsSync(cookieDir)) {
      fs.mkdirSync(cookieDir, { recursive: true });
    }
    this.cookieJar = path.join(cookieDir, 'youtube_session.txt');

    // Allow supplying cookies via environment variables in production
    // Accept either raw Netscape-format content or Base64-encoded content
    try {
      const rawEnvCookies = process.env.YT_COOKIES || process.env.YOUTUBE_COOKIES || null;
      const b64EnvCookies = process.env.YT_COOKIES_BASE64 || process.env.YOUTUBE_COOKIES_BASE64 || null;

      const toNetscape = (text) => {
        const header = `# Netscape HTTP Cookie File\n# This file is generated by the server. Do not edit.\n# ${new Date().toISOString()}\n`;
        const trimmed = (text || '').trim();
        // If content already looks like Netscape, keep as-is
        if (trimmed.startsWith('# Netscape HTTP Cookie File')) {
          return trimmed;
        }
        // Attempt JSON -> Netscape conversion
        try {
          const parsed = JSON.parse(trimmed);
          const cookiesArray = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.cookies) ? parsed.cookies : []);
          if (!cookiesArray.length) {
            // Not a recognizable JSON cookies format; write raw with header
            return `${header}\n${trimmed}`;
          }
          const lines = [header];
          for (const c of cookiesArray) {
            const domain = (c.domain || c.host || '').trim();
            const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
            const pathVal = (c.path || '/');
            const secure = (c.secure || c.isSecure) ? 'TRUE' : 'FALSE';
            // Expiration: use epoch seconds; default to 0 for session cookies
            let expires = 0;
            if (typeof c.expires === 'number') {
              // Some exports use ms; yt-dlp expects seconds
              expires = c.expires > 1e12 ? Math.floor(c.expires / 1000) : c.expires;
            } else if (typeof c.expirationDate === 'number') {
              expires = Math.floor(c.expirationDate);
            } else if (typeof c.expiry === 'number') {
              expires = Math.floor(c.expiry);
            } else if (typeof c.expires === 'string') {
              const ts = Date.parse(c.expires);
              if (!Number.isNaN(ts)) expires = Math.floor(ts / 1000);
            }
            const name = (c.name || '').toString();
            const value = (c.value || '').toString();
            if (!domain || !name) continue; // skip invalid entries
            lines.push([domain, includeSubdomains, pathVal, secure, expires, name, value].join('\t'));
          }
          return lines.join('\n') + '\n';
        } catch {
          // Not JSON; process as raw text
          // 1. Check if it already has the header
          const hasHeader = trimmed.startsWith('# Netscape HTTP Cookie File');

          // 2. Split into lines and process each
          const rawLines = trimmed.split(/\r?\n/);
          const processedLines = [];

          if (!hasHeader) {
            processedLines.push(header.trim());
          }

          for (const line of rawLines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // Keep valid comments and headers
            if (cleanLine.startsWith('#')) {
              processedLines.push(cleanLine);
              continue;
            }

            // check if it's already tab separated (at least 7 fields)
            if (cleanLine.split('\t').length >= 7) {
              processedLines.push(cleanLine);
              continue;
            }

            // Attempt to fix space-separated cookies (common copy-paste issue)
            try {
              // Regex matches: domain flag path secure expiration name value
              const spaceRegex = /^(\S+)\s+(TRUE|FALSE)\s+(\S+)\s+(TRUE|FALSE)\s+(\d+)\s+(\S+)\s+(.+)$/;
              const spaceParts = cleanLine.match(spaceRegex);

              if (spaceParts) {
                // Reconstruct with tabs
                const fixedLine = [
                  spaceParts[1], // domain
                  spaceParts[2], // flag
                  spaceParts[3], // path
                  spaceParts[4], // secure
                  spaceParts[5], // expiration
                  spaceParts[6], // name
                  spaceParts[7]  // value
                ].join('\t');
                processedLines.push(fixedLine);
              } else {
                console.warn('⚠️ Skipping potentially invalid cookie line:', cleanLine.substring(0, 50));
              }
            } catch (err) {
              // Ignore regex errors
            }
          }

          return processedLines.join('\n') + '\n';
        }
      };

      if (b64EnvCookies) {
        const decoded = Buffer.from(b64EnvCookies, 'base64').toString('utf8');
        const netscape = toNetscape(decoded);
        fs.writeFileSync(this.cookieJar, netscape);
        console.log('🍪 Loaded YouTube cookies from Base64 env into .cookies/youtube_session.txt (auto-converted if JSON)');
      } else if (rawEnvCookies) {
        const netscape = toNetscape(rawEnvCookies);
        fs.writeFileSync(this.cookieJar, netscape);
        console.log('🍪 Loaded YouTube cookies from env into .cookies/youtube_session.txt (auto-converted if JSON)');
      }
    } catch (e) {
      console.warn('⚠️ Failed to load cookies from environment variables:', e.message);
    }
  }

  // Enhanced cookie authentication with session persistence
  getCookiesPath() {
    const cookieOptions = [];

    // Prefer persistent cookie jar when available in any environment
    if (fs.existsSync(this.cookieJar)) {
      cookieOptions.push('--cookies', this.cookieJar);
    } else if (!isProductionEnvironment()) {
      // Local development fallback - use cookies from Chrome browser
      cookieOptions.push('--cookies-from-browser', 'chrome');
    }

    return cookieOptions;
  }

  // Advanced user agent rotation with realistic fingerprints
  getAdvancedUserAgent() {
    const browsers = [
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        headers: {
          'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-platform': '"Windows"',
          'sec-ch-ua-mobile': '?0'
        }
      },
      {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        headers: {
          'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-platform': '"macOS"',
          'sec-ch-ua-mobile': '?0'
        }
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      },
      {
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
        headers: {
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"iOS"'
        }
      }
    ];

    return browsers[Math.floor(Math.random() * browsers.length)];
  }

  // Request fingerprint randomization
  generateRequestFingerprint() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Implement realistic request timing
    const minDelay = 2000 + Math.random() * 3000; // 2-5 seconds
    const adaptiveDelay = this.requestCount > 5 ? minDelay * 1.5 : minDelay;

    this.lastRequestTime = now;
    this.requestCount++;

    return {
      delay: adaptiveDelay,
      sessionId: `yt_session_${Math.random().toString(36).substr(2, 9)}`,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
  }

  // Advanced client strategy rotation with mobile app emulation
  // Simplified client strategy relying on standard web client
  // This avoids recent PO Token requirements for TV/Android calls
  getClientStrategy() {
    return {
      name: 'robust_web',
      args: [
        '--extractor-args', 'youtube:player_client=web,web_creator',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ]
    };
  }

  // Enhanced cookie extraction with YouTube Premium support
  async extractYouTubePremiumCookies() {
    let browser = null;
    try {
      console.log('🍪 Extracting YouTube Premium cookies...');

      browser = await puppeteer.launch({
        headless: false, // Show browser for login
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--user-data-dir=/tmp/chrome-user-data'
        ],
        timeout: 60000
      });

      const page = await browser.newPage();

      // Set realistic headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1'
      });

      // Navigate to YouTube Premium login
      await page.goto('https://www.youtube.com/premium', { waitUntil: 'networkidle2' });

      console.log('Please log in to your YouTube Premium account in the browser window...');
      console.log('After logging in, the cookies will be automatically extracted.');

      // Wait for login completion (check for Premium indicators)
      await page.waitForFunction(() => {
        return document.querySelector('[aria-label*="Premium"]') ||
          document.querySelector('.ytd-topbar-logo-renderer') ||
          window.location.href.includes('/feed/subscriptions');
      }, { timeout: 300000 }); // 5 minutes

      // Extract all cookies
      const cookies = await page.cookies();

      // Filter for important YouTube cookies
      const importantCookies = cookies.filter(cookie =>
        ['VISITOR_INFO1_LIVE', 'YSC', 'PREF', 'CONSENT', 'LOGIN_INFO', 'SID', 'HSID', 'SSID', 'APISID', 'SAPISID'].includes(cookie.name)
      );

      // Save cookies in Netscape format
      const cookieString = cookies.map(cookie =>
        `${cookie.domain}\t${cookie.httpOnly ? 'TRUE' : 'FALSE'}\t${cookie.path}\t${cookie.secure ? 'TRUE' : 'FALSE'}\t${Math.floor(cookie.expires || Date.now() / 1000 + 86400)}\t${cookie.name}\t${cookie.value}`
      ).join('\n');

      const cookiesDir = path.join(__dirname, '.cookies');
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookieFile = path.join(cookiesDir, 'youtube_premium.txt');
      fs.writeFileSync(cookieFile, cookieString);

      console.log(`✅ Extracted ${cookies.length} cookies (${importantCookies.length} important) to ${cookieFile}`);

      // Update cookie jar path
      this.cookieJar = cookieFile;

      return cookieFile;

    } catch (error) {
      console.error('❌ YouTube Premium cookie extraction failed:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async rotateCookies() {
    const cookiesDir = path.join(__dirname, '.cookies');
    const cookieFiles = [
      'youtube_premium.txt',
      'youtube_cookies.txt',
      'youtube_backup.txt'
    ];

    // Find available cookie files
    const availableCookies = cookieFiles.filter(file => {
      const filePath = path.join(cookiesDir, file);
      return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
    });

    if (availableCookies.length === 0) {
      console.log('⚠️ No cookie files available for rotation');
      return null;
    }

    // Rotate to next available cookie file
    const currentIndex = this.currentCookieIndex || 0;
    const nextIndex = (currentIndex + 1) % availableCookies.length;
    this.currentCookieIndex = nextIndex;

    const selectedCookieFile = availableCookies[nextIndex];
    const selectedCookiePath = path.join(cookiesDir, selectedCookieFile);

    console.log(`🔄 Rotating to cookie file: ${selectedCookieFile}`);

    // Update cookie jar to use rotated cookies
    this.cookieJar = selectedCookiePath;

    return selectedCookieFile;
  }

  async backupCurrentCookies() {
    const cookiesPath = this.getCookiesPath();
    if (fs.existsSync(cookiesPath)) {
      const cookiesDir = path.dirname(cookiesPath);
      const backupPath = path.join(cookiesDir, 'youtube_backup.txt');
      fs.copyFileSync(cookiesPath, backupPath);
      console.log('💾 Current cookies backed up');
    }
  }

  async refreshCookiesIfNeeded() {
    const cookiesPath = this.getCookiesPath();

    // Check if cookies are older than 24 hours
    if (fs.existsSync(cookiesPath)) {
      const stats = fs.statSync(cookiesPath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

      if (ageInHours > 24) {
        console.log('🔄 Cookies are older than 24 hours, attempting refresh');
        try {
          await this.backupCurrentCookies();
          await this.rotateCookies();
          return true;
        } catch (error) {
          console.error('❌ Cookie refresh failed:', error.message);
          return false;
        }
      }
    }

    return false;
  }

  // Enhanced rotating residential proxy system with multiple providers
  getProxyConfig(preferredRegion = null) {
    // Multi-provider proxy pool with geographic diversity
    const proxyProviders = {
      'brightdata': [
        process.env.BRIGHTDATA_US_1, process.env.BRIGHTDATA_US_2, process.env.BRIGHTDATA_US_3,
        process.env.BRIGHTDATA_EU_1, process.env.BRIGHTDATA_EU_2, process.env.BRIGHTDATA_EU_3,
        process.env.BRIGHTDATA_APAC_1, process.env.BRIGHTDATA_APAC_2, process.env.BRIGHTDATA_APAC_3
      ].filter(Boolean),
      'smartproxy': [
        process.env.SMARTPROXY_US_1, process.env.SMARTPROXY_US_2, process.env.SMARTPROXY_US_3,
        process.env.SMARTPROXY_EU_1, process.env.SMARTPROXY_EU_2, process.env.SMARTPROXY_EU_3,
        process.env.SMARTPROXY_APAC_1, process.env.SMARTPROXY_APAC_2, process.env.SMARTPROXY_APAC_3
      ].filter(Boolean),
      'oxylabs': [
        process.env.OXYLABS_US_1, process.env.OXYLABS_US_2, process.env.OXYLABS_US_3,
        process.env.OXYLABS_EU_1, process.env.OXYLABS_EU_2, process.env.OXYLABS_EU_3,
        process.env.OXYLABS_APAC_1, process.env.OXYLABS_APAC_2, process.env.OXYLABS_APAC_3
      ].filter(Boolean),
      'legacy': [
        // US proxies
        process.env.US_PROXY_1, process.env.US_PROXY_2, process.env.US_PROXY_3,
        // EU proxies
        process.env.EU_PROXY_1, process.env.EU_PROXY_2, process.env.EU_PROXY_3,
        // Asia-Pacific proxies
        process.env.APAC_PROXY_1, process.env.APAC_PROXY_2, process.env.APAC_PROXY_3,
        // Fallback to basic proxies
        process.env.HTTP_PROXY, process.env.HTTPS_PROXY, process.env.SOCKS_PROXY
      ].filter(Boolean)
    };

    // Combine all available proxies
    const allProxies = Object.values(proxyProviders).flat().filter(Boolean);

    if (allProxies.length === 0) {
      console.log('No proxies configured, proceeding without proxy');
      return [];
    }

    // More aggressive rotation for YouTube: every 2-3 requests or every 90 seconds
    const now = Date.now();
    const timeSinceLastRotation = now - (this.lastProxyRotation || 0);

    if (!this.lastProxyRotation ||
      this.requestCount % (2 + Math.floor(Math.random() * 2)) === 0 ||
      timeSinceLastRotation > 90000) {

      // Skip failed proxies for 10 minutes
      let attempts = 0;
      let selectedProxy;

      do {
        this.proxyRotation = (this.proxyRotation + 1) % allProxies.length;
        selectedProxy = allProxies[this.proxyRotation];
        attempts++;

        const failureKey = selectedProxy;
        const lastFailure = this.proxyFailures.get(failureKey);

        if (!lastFailure || (now - lastFailure) > 600000) { // 10 minutes
          break;
        }
      } while (attempts < allProxies.length);

      this.lastProxyRotation = now;

      // Determine proxy provider for logging
      const provider = Object.keys(proxyProviders).find(key =>
        proxyProviders[key].includes(selectedProxy)
      ) || 'unknown';

      console.log(`🌐 Rotating to ${provider} proxy ${this.proxyRotation + 1}/${allProxies.length}: ${selectedProxy.substring(0, 25)}...`);
    }

    const currentProxy = allProxies[this.proxyRotation];

    // Enhanced proxy protocol support
    if (currentProxy.startsWith('socks5://') || currentProxy.startsWith('socks4://')) {
      return ['--proxy', currentProxy];
    } else if (currentProxy.startsWith('http://') || currentProxy.startsWith('https://')) {
      return ['--proxy', currentProxy];
    } else {
      // Assume HTTP if no protocol specified
      return ['--proxy', `http://${currentProxy}`];
    }
  }

  // Mark proxy as failed with exponential backoff
  markProxyFailed(proxyUrl) {
    const now = Date.now();
    const failureCount = this.proxyFailures.get(proxyUrl + '_count') || 0;
    const backoffTime = Math.min(600000, 60000 * Math.pow(2, failureCount)); // Max 10 minutes

    this.proxyFailures.set(proxyUrl, now + backoffTime);
    this.proxyFailures.set(proxyUrl + '_count', failureCount + 1);

    console.log(`❌ Marking proxy as failed (attempt ${failureCount + 1}): ${proxyUrl.substring(0, 25)}... (backoff: ${Math.round(backoffTime / 1000)}s)`);
  }

  // Advanced rate limiting with exponential backoff and adaptive throttling
  async implementRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - (this.lastRequestTime || 0);

    // Initialize advanced tracking if not exists
    if (!this.requestHistory) {
      this.requestHistory = [];
      this.failureHistory = [];
      this.successRate = 1.0;
      this.adaptiveMultiplier = 1.0;
      this.lastSuccessTime = now;
    }

    // Clean old data (older than 2 hours for better pattern analysis)
    const cutoffTime = now - 7200000; // 2 hours
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime);
    this.failureHistory = this.failureHistory.filter(fail => fail.timestamp > cutoffTime);

    // Calculate success rate over different time windows
    const windows = {
      '5min': now - 300000,
      '15min': now - 900000,
      '1hour': now - 3600000
    };

    const windowStats = {};
    Object.entries(windows).forEach(([window, cutoff]) => {
      const requests = this.requestHistory.filter(req => req.timestamp > cutoff);
      const failures = this.failureHistory.filter(fail => fail.timestamp > cutoff);
      windowStats[window] = {
        total: requests.length,
        failures: failures.length,
        successRate: requests.length > 0 ? (requests.length - failures.length) / requests.length : 1.0
      };
    });

    // Advanced exponential backoff calculation
    let baseDelay = 2000; // 2 seconds base

    // Factor 1: Exponential backoff based on consecutive failures
    const consecutiveFailures = this.consecutiveFailures || 0;
    if (consecutiveFailures > 0) {
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, consecutiveFailures - 1),
        300000 // Max 5 minutes
      );
      baseDelay = Math.max(baseDelay, exponentialDelay);
    }

    // Factor 2: Adaptive throttling based on success rate
    const recentSuccessRate = windowStats['15min'].successRate;
    if (recentSuccessRate < 0.5) {
      this.adaptiveMultiplier = Math.min(this.adaptiveMultiplier * 1.5, 10.0);
    } else if (recentSuccessRate > 0.8) {
      this.adaptiveMultiplier = Math.max(this.adaptiveMultiplier * 0.9, 0.5);
    }
    baseDelay *= this.adaptiveMultiplier;

    // Factor 3: Request frequency analysis with sliding window
    const recentRequests = this.requestHistory.filter(req => req.timestamp > now - 600000);
    if (recentRequests.length > 20) {
      const frequencyPenalty = Math.pow(1.2, recentRequests.length - 20);
      baseDelay *= frequencyPenalty;
    }

    // Factor 4: Failure pattern analysis
    const recentFailures = this.failureHistory.filter(fail => fail.timestamp > now - 900000);
    const failureTypes = {};
    recentFailures.forEach(fail => {
      failureTypes[fail.type] = (failureTypes[fail.type] || 0) + 1;
    });

    // Adjust delay based on failure patterns
    if (failureTypes['rate_limit'] > 3) {
      baseDelay *= 2.5; // Heavy penalty for rate limiting
    }
    if (failureTypes['bot_detection'] > 2) {
      baseDelay *= 3.0; // Severe penalty for bot detection
    }
    if (failureTypes['timeout'] > 5) {
      baseDelay *= 1.5; // Moderate penalty for timeouts
    }

    // Factor 5: Time-based adaptive scheduling
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Peak hours adjustment (more aggressive)
    if (hour >= 17 && hour <= 23) { // 5PM-11PM
      baseDelay *= 1.8;
    } else if (hour >= 12 && hour <= 16) { // 12PM-4PM
      baseDelay *= 1.3;
    } else if (hour >= 2 && hour <= 6) { // 2AM-6AM (optimal)
      baseDelay *= 0.6;
    }

    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      baseDelay *= 1.2;
    }

    // Factor 6: Circuit breaker with graduated recovery
    if (this.isCircuitBreakerActive()) {
      const breakerTime = this.circuitBreakerUntil - now;
      const recoveryMultiplier = Math.max(2.0, breakerTime / 60000); // 2x to 5x based on remaining time
      baseDelay = Math.max(baseDelay, 60000 * recoveryMultiplier);
    }

    // Factor 7: Intelligent jitter (larger jitter for higher delays)
    const jitterRange = Math.min(baseDelay * 0.3, 10000); // 30% of delay, max 10s
    const jitter = (Math.random() - 0.5) * jitterRange;
    const totalDelay = Math.max(1000, baseDelay + jitter); // Minimum 1s delay

    // Factor 8: Burst protection (prevent rapid successive requests)
    const burstWindow = 30000; // 30 seconds
    const burstRequests = this.requestHistory.filter(req => req.timestamp > now - burstWindow);
    if (burstRequests.length >= 3) {
      const burstPenalty = Math.pow(1.5, burstRequests.length - 2);
      const adjustedDelay = totalDelay * burstPenalty;

      if (timeSinceLastRequest < adjustedDelay) {
        const waitTime = adjustedDelay - timeSinceLastRequest;
        console.log(`🛡️ Burst protection: waiting ${Math.round(waitTime / 1000)}s`);
        console.log(`   📊 Burst requests: ${burstRequests.length}, penalty: ${burstPenalty.toFixed(2)}x`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } else if (timeSinceLastRequest < totalDelay) {
      const waitTime = totalDelay - timeSinceLastRequest;
      console.log(`⏱️ Advanced rate limiting: waiting ${Math.round(waitTime / 1000)}s`);
      console.log(`   📊 Stats: success=${(recentSuccessRate * 100).toFixed(1)}%, failures=${consecutiveFailures}, adaptive=${this.adaptiveMultiplier.toFixed(2)}x`);
      console.log(`   🕐 Factors: hour=${hour}, requests=${recentRequests.length}, circuit=${this.isCircuitBreakerActive()}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request with metadata
    this.requestHistory.push({
      timestamp: now,
      hour: hour,
      dayOfWeek: dayOfWeek,
      delay: totalDelay,
      adaptiveMultiplier: this.adaptiveMultiplier
    });
    this.lastRequestTime = now;
  }

  recordSuccess() {
    const now = Date.now();
    this.consecutiveFailures = 0;
    this.lastSuccessTime = now;

    // Gradually reduce adaptive multiplier on success
    if (this.adaptiveMultiplier > 1.0) {
      this.adaptiveMultiplier = Math.max(this.adaptiveMultiplier * 0.95, 0.8);
    }

    // Reset circuit breaker if it was active
    if (this.circuitBreakerUntil && now >= this.circuitBreakerUntil) {
      console.log('✅ Circuit breaker reset after successful request');
      this.circuitBreakerUntil = null;
    }

    console.log(`✅ Request successful - failures reset, adaptive=${this.adaptiveMultiplier.toFixed(2)}x`);
  }

  recordFailure(errorType = 'unknown') {
    const now = Date.now();
    this.consecutiveFailures = (this.consecutiveFailures || 0) + 1;

    // Initialize failure history if needed
    if (!this.failureHistory) {
      this.failureHistory = [];
    }

    // Record detailed failure information
    this.failureHistory.push({
      timestamp: now,
      type: errorType,
      consecutiveCount: this.consecutiveFailures,
      timeSinceLastSuccess: now - (this.lastSuccessTime || now)
    });

    console.log(`❌ Request failed (${errorType}) - consecutive failures: ${this.consecutiveFailures}`);

    // Advanced circuit breaker with graduated thresholds
    const timeSinceLastSuccess = now - (this.lastSuccessTime || now);
    let breakerThreshold = 8; // Default threshold

    // Lower threshold for critical error types
    if (['bot_detection', 'captcha_required'].includes(errorType)) {
      breakerThreshold = 5;
    } else if (['rate_limit', 'forbidden'].includes(errorType)) {
      breakerThreshold = 6;
    }

    // Activate circuit breaker with adaptive duration
    if (this.consecutiveFailures >= breakerThreshold) {
      let breakerDuration = 3 * 60 * 1000; // Base 3 minutes

      // Increase duration based on failure severity and frequency
      if (errorType === 'bot_detection') {
        breakerDuration *= 3; // 9 minutes for bot detection
      } else if (errorType === 'rate_limit') {
        breakerDuration *= 2; // 6 minutes for rate limiting
      }

      // Increase duration if failures are happening too frequently
      if (timeSinceLastSuccess < 300000) { // Less than 5 minutes since last success
        breakerDuration *= 1.5;
      }

      // Progressive penalty for repeated circuit breaker activations
      const recentBreakers = this.failureHistory.filter(fail =>
        fail.timestamp > now - 3600000 && // Last hour
        fail.consecutiveCount >= breakerThreshold
      ).length;

      if (recentBreakers > 1) {
        breakerDuration *= Math.pow(1.5, recentBreakers - 1);
      }

      this.circuitBreakerUntil = now + Math.min(breakerDuration, 30 * 60 * 1000); // Max 30 minutes

      console.log(`🚨 Circuit breaker activated for ${Math.round(breakerDuration / 60000)} minutes`);
      console.log(`   🔍 Trigger: ${this.consecutiveFailures}/${breakerThreshold} failures, type: ${errorType}`);
    }
  }

  isCircuitBreakerActive() {
    if (this.circuitBreakerUntil && Date.now() < this.circuitBreakerUntil) {
      const remainingTime = Math.round((this.circuitBreakerUntil - Date.now()) / 1000);
      const remainingMinutes = Math.round(remainingTime / 60);

      if (remainingTime % 30 === 0 || remainingTime < 10) { // Log every 30s or final 10s
        console.log(`🚨 Circuit breaker active: ${remainingMinutes}m ${remainingTime % 60}s remaining`);
      }
      return true;
    }

    // Check for half-open state (allow one test request after breaker expires)
    if (this.circuitBreakerUntil && Date.now() >= this.circuitBreakerUntil) {
      console.log('🔄 Circuit breaker entering half-open state - allowing test request');
      this.circuitBreakerUntil = null; // Reset for test
    }

    return false;
  }

  // Get current system performance metrics
  getPerformanceMetrics() {
    const now = Date.now();
    const windows = {
      '5min': now - 300000,
      '15min': now - 900000,
      '1hour': now - 3600000
    };

    const metrics = {};
    Object.entries(windows).forEach(([window, cutoff]) => {
      const requests = (this.requestHistory || []).filter(req => req.timestamp > cutoff);
      const failures = (this.failureHistory || []).filter(fail => fail.timestamp > cutoff);

      metrics[window] = {
        totalRequests: requests.length,
        totalFailures: failures.length,
        successRate: requests.length > 0 ? ((requests.length - failures.length) / requests.length * 100).toFixed(1) + '%' : 'N/A',
        avgDelay: requests.length > 0 ? Math.round(requests.reduce((sum, req) => sum + (req.delay || 0), 0) / requests.length / 1000) + 's' : 'N/A'
      };
    });

    return {
      ...metrics,
      consecutiveFailures: this.consecutiveFailures || 0,
      adaptiveMultiplier: (this.adaptiveMultiplier || 1.0).toFixed(2) + 'x',
      circuitBreakerActive: this.isCircuitBreakerActive(),
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : 'Never'
    };
  }

  // CAPTCHA solving integration for automated cookie refresh
  async solveCaptcha(captchaImageUrl, captchaType = 'image') {
    const captchaApiKey = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

    if (!captchaApiKey) {
      console.log('⚠️ No CAPTCHA API key found, skipping CAPTCHA solving');
      throw new Error('CAPTCHA API key not configured');
    }

    try {
      console.log('🧩 Attempting to solve CAPTCHA...');

      // Using 2captcha service (can be adapted for other services)
      const submitResponse = await fetch('http://2captcha.com/in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: captchaApiKey,
          method: 'base64',
          body: captchaImageUrl.startsWith('data:') ? captchaImageUrl.split(',')[1] : captchaImageUrl,
          json: 1
        })
      });

      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`CAPTCHA submission failed: ${submitResult.error_text}`);
      }

      const captchaId = submitResult.request;
      console.log(`🧩 CAPTCHA submitted with ID: ${captchaId}`);

      // Poll for result (wait up to 2 minutes)
      for (let i = 0; i < 24; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const resultResponse = await fetch(`http://2captcha.com/res.php?key=${captchaApiKey}&action=get&id=${captchaId}&json=1`);
        const result = await resultResponse.json();

        if (result.status === 1) {
          console.log('✅ CAPTCHA solved successfully');
          return result.request; // The solved CAPTCHA text
        } else if (result.error_text && result.error_text !== 'CAPCHA_NOT_READY') {
          throw new Error(`CAPTCHA solving failed: ${result.error_text}`);
        }

        console.log(`🧩 CAPTCHA not ready yet, waiting... (attempt ${i + 1}/24)`);
      }

      throw new Error('CAPTCHA solving timeout');

    } catch (error) {
      console.error('❌ CAPTCHA solving error:', error.message);
      throw error;
    }
  }

  // Enhanced cookie extraction with CAPTCHA handling
  async extractCookiesWithCaptchaSolving(url) {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();

      // Set realistic user agent and viewport
      await page.setUserAgent(this.getAdvancedUserAgent().desktop.chrome);
      await page.setViewport({ width: 1920, height: 1080 });

      console.log('🍪 Navigating to YouTube for cookie extraction with CAPTCHA handling...');
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 30000 });

      // Check for CAPTCHA presence
      const captchaDetected = await page.evaluate(() => {
        // Common CAPTCHA selectors
        const captchaSelectors = [
          '[src*="captcha"]',
          '[src*="recaptcha"]',
          '.g-recaptcha',
          '#captcha',
          '.captcha-container',
          '[data-callback*="captcha"]'
        ];

        return captchaSelectors.some(selector => document.querySelector(selector));
      });

      if (captchaDetected) {
        console.log('🧩 CAPTCHA detected, attempting to solve...');

        try {
          // Extract CAPTCHA image
          const captchaImage = await page.evaluate(() => {
            const img = document.querySelector('[src*="captcha"], [src*="recaptcha"]');
            return img ? img.src : null;
          });

          if (captchaImage) {
            const captchaSolution = await this.solveCaptcha(captchaImage);

            // Input CAPTCHA solution
            const captchaInput = await page.$('input[name*="captcha"], input[id*="captcha"], input[type="text"]');
            if (captchaInput) {
              await captchaInput.type(captchaSolution);

              // Submit CAPTCHA
              const submitButton = await page.$('button[type="submit"], input[type="submit"], button:contains("Submit")');
              if (submitButton) {
                await submitButton.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                console.log('✅ CAPTCHA submitted successfully');
              }
            }
          }
        } catch (captchaError) {
          console.log('⚠️ CAPTCHA solving failed, continuing without solving:', captchaError.message);
        }
      }

      // Continue with normal cookie extraction
      await page.waitForTimeout(3000);

      // Extract cookies
      const cookies = await page.cookies();
      const youtubeCookies = cookies.filter(cookie =>
        cookie.domain.includes('youtube.com') || cookie.domain.includes('google.com')
      );

      if (youtubeCookies.length > 0) {
        // Save cookies in Netscape format
        const cookiesPath = this.getCookiesPath();
        const netscapeCookies = youtubeCookies.map(cookie => {
          const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
          const flag = cookie.httpOnly ? 'TRUE' : 'FALSE';
          const path = cookie.path || '/';
          const secure = cookie.secure ? 'TRUE' : 'FALSE';
          const expiration = cookie.expires ? Math.floor(cookie.expires) : '0';
          return `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${cookie.name}\t${cookie.value}`;
        }).join('\n');

        await fs.writeFile(cookiesPath, `# Netscape HTTP Cookie File\n${netscapeCookies}`, 'utf8');
        console.log(`✅ Extracted ${youtubeCookies.length} cookies with CAPTCHA handling to ${cookiesPath}`);

        return youtubeCookies;
      } else {
        throw new Error('No YouTube cookies found after CAPTCHA solving');
      }

    } finally {
      await browser.close();
    }
  }

  // Automatic CAPTCHA-aware cookie refresh
  async refreshCookiesWithCaptchaHandling() {
    try {
      console.log('🔄 Starting automatic cookie refresh with CAPTCHA handling...');

      // First try normal extraction
      try {
        await this.extractYouTubePremiumCookies();
        console.log('✅ Cookie refresh completed without CAPTCHA');
        return;
      } catch (normalError) {
        console.log('ℹ️ Normal cookie extraction failed, trying with CAPTCHA handling...');
      }

      // If normal extraction fails, try with CAPTCHA solving
      await this.extractCookiesWithCaptchaSolving('https://www.youtube.com');
      console.log('✅ Cookie refresh completed with CAPTCHA handling');

    } catch (error) {
      console.error('❌ Cookie refresh with CAPTCHA handling failed:', error.message);
      throw error;
    }
  }

  // Proxy health check and failover
  async checkProxyHealth(proxyUrl) {
    try {
      const testUrl = 'https://httpbin.org/ip';
      const response = await fetch(testUrl, {
        method: 'GET',
        timeout: 10000,
        agent: this.createProxyAgent(proxyUrl)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Proxy health check passed: ${proxyUrl} -> IP: ${data.origin}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ Proxy health check failed: ${proxyUrl} -> ${error.message}`);
    }
    return false;
  }

  // Create proxy agent for different protocols
  createProxyAgent(proxyUrl) {
    // This would require additional proxy agent libraries
    // For now, return null and let yt-dlp handle proxy configuration
    return null;
  }

  // Geographic proxy selection for specific regions
  getGeoSpecificProxy(region = 'random') {
    const geoProxies = {
      'us': [
        process.env.US_PROXY_1,
        process.env.US_PROXY_2,
        process.env.US_PROXY_3
      ].filter(Boolean),
      'eu': [
        process.env.EU_PROXY_1,
        process.env.EU_PROXY_2,
        process.env.EU_PROXY_3
      ].filter(Boolean),
      'apac': [
        process.env.APAC_PROXY_1,
        process.env.APAC_PROXY_2,
        process.env.APAC_PROXY_3
      ].filter(Boolean)
    };

    if (region === 'random') {
      const regions = Object.keys(geoProxies).filter(r => geoProxies[r].length > 0);
      if (regions.length === 0) return [];
      region = regions[Math.floor(Math.random() * regions.length)];
    }

    const regionProxies = geoProxies[region] || [];
    if (regionProxies.length === 0) return [];

    const selectedProxy = regionProxies[Math.floor(Math.random() * regionProxies.length)];
    console.log(`🌍 Using ${region.toUpperCase()} proxy: ${selectedProxy.substring(0, 20)}...`);

    return ['--proxy', selectedProxy];
  }

  // Session persistence and caching
  getSessionArgs(url) {
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const sessionKey = `session_${urlHash}`;

    if (this.sessionCache.has(sessionKey)) {
      const session = this.sessionCache.get(sessionKey);
      if (Date.now() - session.timestamp < 300000) { // 5 minutes
        return session.args;
      }
    }

    const fingerprint = this.generateRequestFingerprint();
    const browser = this.getAdvancedUserAgent();
    const strategy = this.getClientStrategy();
    const proxy = this.getProxyConfig();

    const sessionArgs = [
      '--user-agent', browser.ua,
      '--add-header', 'Accept-Language:en-US,en;q=0.9,es;q=0.8',
      '--add-header', 'Accept-Encoding:gzip, deflate, br, zstd',
      '--add-header', 'DNT:1',
      '--add-header', 'Upgrade-Insecure-Requests:1',
      '--add-header', 'Sec-Fetch-Dest:document',
      '--add-header', 'Sec-Fetch-Mode:navigate',
      '--add-header', 'Sec-Fetch-Site:none',
      '--add-header', 'Sec-Fetch-User:?1',
      ...strategy.args,
      ...proxy
    ];

    // Add browser-specific headers
    Object.entries(browser.headers || {}).forEach(([key, value]) => {
      sessionArgs.push('--add-header', `${key}:${value}`);
    });

    this.sessionCache.set(sessionKey, {
      args: sessionArgs,
      timestamp: Date.now(),
      strategy: strategy.name,
      fingerprint
    });

    return sessionArgs;
  }

  // Adaptive delay based on request history
  async addAdaptiveDelay() {
    const fingerprint = this.generateRequestFingerprint();
    await new Promise(resolve => setTimeout(resolve, fingerprint.delay));
    return fingerprint;
  }

  // Browser automation fallback using Puppeteer
  async extractWithBrowser(url) {
    let browser = null;
    try {
      console.log('Attempting browser automation extraction for:', url);

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        ],
        timeout: 30000
      });

      const page = await browser.newPage();

      // Set realistic viewport and headers
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
      });

      // Navigate to YouTube video
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for video player to load
      await page.waitForSelector('video', { timeout: 15000 });

      // Extract video information
      const videoInfo = await page.evaluate(() => {
        const video = document.querySelector('video');
        const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title');
        const uploaderElement = document.querySelector('#owner-name a, .ytd-channel-name a');
        const descriptionElement = document.querySelector('#description-text, .description');
        const viewCountElement = document.querySelector('#info-text, .view-count');

        return {
          title: titleElement?.textContent?.trim() || 'Unknown Title',
          duration: video?.duration || 0,
          durationString: video?.duration ? new Date(video.duration * 1000).toISOString().substr(11, 8) : '0:00',
          uploader: uploaderElement?.textContent?.trim() || 'Unknown',
          description: descriptionElement?.textContent?.trim() || '',
          viewCount: viewCountElement?.textContent?.trim() || '0',
          thumbnail: video?.poster || '',
          platform: 'YouTube'
        };
      });

      console.log('Browser automation extraction successful');
      return videoInfo;

    } catch (error) {
      console.error('Browser automation failed:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Enhanced cookie extraction from browser session
  async extractAndSaveCookies(url) {
    let browser = null;
    try {
      console.log('Extracting fresh cookies from browser session');

      browser = await puppeteer.launch({
        headless: false, // Show browser for cookie consent
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 30000
      });

      const page = await browser.newPage();
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

      // Wait for user to handle any cookie consent or login
      console.log('Waiting 10 seconds for cookie consent/login...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Extract cookies
      const cookies = await page.cookies();

      // Ensure cookie directory exists
      const jarDir = path.dirname(this.cookieJar);
      if (!fs.existsSync(jarDir)) {
        fs.mkdirSync(jarDir, { recursive: true });
      }

      // Save cookies in valid Netscape/Mozilla format expected by yt-dlp
      // Format: domain \t include_subdomains \t path \t secure \t expires(epoch) \t name \t value
      // Include header recognized by Python's MozillaCookieJar
      const header = [
        '# Netscape HTTP Cookie File',
        '# This file was generated by YouTubeBypassManager',
        '# Format: <domain> <flag> <path> <secure> <expiration> <name> <value>'
      ].join('\n');

      const lines = cookies.map(cookie => {
        // Host-only cookies should have include_subdomains = FALSE and domain without leading dot
        const isHostOnly = !cookie.domain.startsWith('.');
        const includeSubdomains = isHostOnly ? 'FALSE' : 'TRUE';

        // Ensure domain formatting: leading dot only when include_subdomains is TRUE
        const domain = isHostOnly ? cookie.domain.replace(/^\./, '') : (cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`);

        // Path default
        const pathVal = cookie.path || '/';

        // Secure flag
        const secure = cookie.secure ? 'TRUE' : 'FALSE';

        // Expiration: Puppeteer uses seconds; -1 indicates session cookie. Use 1 year for session cookies.
        const expiresRaw = typeof cookie.expires === 'number' ? cookie.expires : -1;
        const expires = (expiresRaw && expiresRaw > 0) ? Math.floor(expiresRaw) : Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

        return `${domain}\t${includeSubdomains}\t${pathVal}\t${secure}\t${expires}\t${cookie.name}\t${cookie.value}`;
      });

      const cookieFile = `${header}\n\n${lines.join('\n')}`;
      fs.writeFileSync(this.cookieJar, cookieFile);
      // Validate write
      const stats = fs.statSync(this.cookieJar);
      if (!stats || stats.size === 0) {
        throw new Error('Cookie jar file is empty after write');
      }
      console.log('Cookies saved successfully');

    } catch (error) {
      console.error('Cookie extraction failed:', error.message);
      // Propagate error so callers can handle properly
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// Initialize the bypass manager
const youtubeBypass = new YouTubeBypassManager();

// Legacy functions for backward compatibility
function getCookiesPath() {
  return youtubeBypass.getCookiesPath();
}

function getRandomUserAgent() {
  return youtubeBypass.getAdvancedUserAgent().ua;
}

function addRandomDelay() {
  return youtubeBypass.addAdaptiveDelay();
}
import express from 'express';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import cors from 'cors';
import archiver from 'archiver';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Added multer for video file uploads and Puppeteer for browser automation

// Configure Puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store WebSocket connections by session ID
const wsConnections = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 DEBUG: WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('🔌 DEBUG: Received WebSocket message:', data);
      if (data.type === 'register' && data.sessionId) {
        wsConnections.set(data.sessionId, ws);
        console.log(`🔌 DEBUG: WebSocket registered for session: ${data.sessionId}`);
        console.log(`🔌 DEBUG: Total registered sessions: ${wsConnections.size}`);
      }
    } catch (error) {
      console.error('🔌 DEBUG: WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    // Remove connection from map when client disconnects
    for (const [sessionId, connection] of wsConnections.entries()) {
      if (connection === ws) {
        wsConnections.delete(sessionId);
        console.log(`WebSocket disconnected for session: ${sessionId}`);

        // Clean up any active downloads for this session
        for (const [downloadUrl, downloadInfo] of activeDownloads.entries()) {
          if (downloadInfo.sessionId === sessionId) {
            console.log(`🧹 Cleaning up download for disconnected session: ${sessionId}, URL: ${downloadUrl}`);
            // Don't terminate the download, just remove the session association
            downloadInfo.sessionId = null;
          }
        }
        break;
      }
    }
  });
});

// Function to send progress updates via WebSocket
function sendProgressUpdate(sessionId, type, progress, details = {}) {
  // Skip if sessionId is null (session was disconnected)
  if (!sessionId) {
    return;
  }

  const ws = wsConnections.get(sessionId);
  // Log only once per session/type combo or on errors to reduce noise
  // console.log(`📡 SERVER DEBUG: Attempting to send progress update for session: ${sessionId}`);

  if (ws && ws.readyState === ws.OPEN) {
    const message = {
      type: 'progress',
      operation: type,
      progress: progress,
      ...details
    };

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`📡 SERVER DEBUG: Error sending WebSocket message:`, error);
    }
  } else {
    // Suppress "WebSocket not available" log as it spams heavily during downloads
    // console.log(`📡 SERVER DEBUG: Cannot send progress - WebSocket not available or not open`);
  }
}

// CORS configuration for production deployment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Get allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim())
      : [
        'http://localhost:3000',
        'http://localhost:3001', // Local development server
        'http://localhost:5173', // Vite dev server
        'http://localhost:8082', // Vite dev server (alternative port)
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8082',
        'http://localhost:3002'
      ];

    // Add common deployment domains if not explicitly set
    if (!process.env.ALLOWED_ORIGINS) {
      // Add Railway domains
      if (process.env.RAILWAY_PROJECT_ID) {
        allowedOrigins.push(`https://${process.env.RAILWAY_PROJECT_ID}.railway.app`);
      }

      // Add Vercel domains
      if (origin && origin.includes('.vercel.app')) {
        allowedOrigins.push(origin);
      }

      // Explicitly add known Vercel domain
      allowedOrigins.push('https://media-harvest.vercel.app');
    }

    // Check for Vercel deployments (generic)
    if (origin && (origin.endsWith('.vercel.app') || origin.includes('vercel.app'))) {
      allowedOrigins.push(origin);
    }

    // In development or if CORS check is disabled, allow all
    if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_CORS_CHECK === 'true') {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`❌ CORS blocked request from origin: ${origin}`);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS (Origin: ${origin})`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Middleware
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Serve static files from current directory (frontend files) - DISABLED to use dist folder instead
// app.use(express.static(__dirname));

// Configure multer for video file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files including MXF
    // Also accept files without extensions if they have video mimetype
    if (file.mimetype.startsWith('video/') ||
      file.originalname.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mxf)$/i) ||
      (file.mimetype === 'application/octet-stream' && !path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Check if yt-dlp is installed
// Global variable to store the found yt-dlp path
let ytDlpPath = null;

function checkYtDlp() {
  return new Promise((resolve) => {
    // Try different possible yt-dlp locations
    const possiblePaths = [
      'yt-dlp', // System PATH
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/home/daniel/.local/bin/yt-dlp', // Local development
      './yt-dlp'
    ];

    let pathIndex = 0;

    function tryNextPath() {
      if (pathIndex >= possiblePaths.length) {
        resolve(false);
        return;
      }

      const currentPath = possiblePaths[pathIndex];
      const ytDlp = spawn(currentPath, ['--version']);

      ytDlp.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Found yt-dlp at: ${currentPath}`);
          ytDlpPath = currentPath; // Store the working path
          resolve(true);
        } else {
          pathIndex++;
          tryNextPath();
        }
      });

      ytDlp.on('error', () => {
        pathIndex++;
        tryNextPath();
      });
    }

    tryNextPath();
  });
}

// Function to get the correct yt-dlp path
const getYtDlpPath = async () => {
  // If we already found it, return it
  if (global.ytDlpPath) return global.ytDlpPath;

  console.log('🔍 Searching for yt-dlp...');

  // Try to find yt-dlp in various paths
  const possiblePaths = [
    'yt-dlp', // System PATH
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/app/yt-dlp', // Railway container root
    '/app/node_modules/.bin/yt-dlp', // Local node_modules
    '/home/daniel/.local/bin/yt-dlp', // Local development
    './yt-dlp'
  ];

  for (const currentPath of possiblePaths) {
    try {
      console.log(`  Checking: ${currentPath}`);
      const { stdout } = await execPromise(`${currentPath} --version`);
      console.log(`  ✅ Found yt-dlp at: ${currentPath} (Version: ${stdout.trim()})`);
      global.ytDlpPath = currentPath;
      return currentPath;
    } catch (e) {
      // Continue to next path
    }
  }

  // Fallback: Try using python directly
  try {
    console.log('  Checking: python3 -m yt_dlp');
    const { stdout } = await execPromise('python3 -m yt_dlp --version');
    console.log(`  ✅ Found yt-dlp via python module (Version: ${stdout.trim()})`);
    global.ytDlpPath = 'python3 -m yt_dlp';
    return 'python3 -m yt_dlp';
  } catch (e) {
    // Continue
  }

  console.error('❌ yt-dlp not found in any standard location');
  return 'yt-dlp'; // Return default and hope for the best
};

// Function to detect production environment
function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.PORT === '3000' || // Railway default port
    process.env.HOSTNAME?.includes('railway.app');
}

// Detect platform from URL
function detectPlatform(url) {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube';
  } else if (urlLower.includes('instagram.com')) {
    return 'instagram';
  } else if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
    return 'facebook';
  } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter';
  } else if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  } else if (urlLower.includes('vimeo.com')) {
    return 'vimeo';
  } else if (urlLower.includes('dailymotion.com')) {
    return 'dailymotion';
  } else if (urlLower.includes('twitch.tv')) {
    return 'twitch';
  } else if (urlLower.includes('reddit.com')) {
    return 'reddit';
  } else if (urlLower.includes('streamable.com')) {
    return 'streamable';
  } else if (urlLower.includes('rumble.com')) {
    return 'rumble';
  } else if (urlLower.includes('bitchute.com')) {
    return 'bitchute';
  } else if (urlLower.includes('odysee.com') || urlLower.includes('lbry.tv')) {
    return 'odysee';
  } else if (urlLower.includes('pornhub.com')) {
    return 'pornhub';
  } else if (urlLower.includes('xvideos.com')) {
    return 'xvideos';
  } else if (urlLower.match(/\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v)$/i)) {
    return 'direct-video';
  } else {
    return 'generic';
  }
}

// Quality format mappings
// Use separate video+audio for best quality and explicit height caps
// Quality format mappings
// Use separate video+audio for best quality and explicit height caps
// UPDATED: Prefer H.264 (avc) for best compatibility with QuickTime/Finder/VLC
const qualityFormats = {
  'maximum': 'bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/best[vcodec^=avc]/bestvideo+bestaudio/best',
  'high': 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/best[height<=1080][vcodec^=avc]/bestvideo[height<=1080]+bestaudio/best',
  'medium': 'bestvideo[height<=720][vcodec^=avc]+bestaudio[ext=m4a]/best[height<=720][vcodec^=avc]/bestvideo[height<=720]+bestaudio/best',
  'low': 'bestvideo[height<=480][vcodec^=avc]+bestaudio[ext=m4a]/best[height<=480][vcodec^=avc]/bestvideo[height<=480]+bestaudio/best',
  'audio': 'bestaudio/best'
}

// Alternative format strategies for bypassing restrictions
// Fall back to single-file best when separate streams aren’t available
const alternativeFormats = {
  'maximum': ['bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/best', 'best'],
  'high': ['bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/best', 'best[height<=1080]/best'],
  'medium': ['bestvideo[height<=720][vcodec^=avc]+bestaudio[ext=m4a]/best', 'best[height<=720]/best'],
  'low': ['bestvideo[height<=480][vcodec^=avc]+bestaudio[ext=m4a]/best', 'best[height<=480]/best'],
  'audio': ['bestaudio', 'best']
}

// Get available quality options endpoint
// Removed manual cookie upload endpoint - using automated extraction instead

// Test endpoint to verify deployment version
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    hasConvertEndpoint: true,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'local'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/quality-options', (req, res) => {
  res.json({
    options: [
      { value: 'maximum', label: 'Best Quality (Highest available)', description: 'Best available quality, including 4K when present' },
      { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
      { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
      { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' },
      { value: 'audio', label: 'Audio Only', description: 'Extract audio only (M4A/MP3)' }
    ]
  });
});

// Track active downloads
const activeDownloads = new Map();

// Cancel download endpoint
app.post('/api/cancel-download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const downloadInfo = activeDownloads.get(url);
  if (downloadInfo) {
    const { ytDlp, tempDir, cleanup } = downloadInfo;

    if (ytDlp && !ytDlp.killed) {
      ytDlp.kill('SIGTERM');
      setTimeout(() => {
        if (ytDlp && !ytDlp.killed) {
          ytDlp.kill('SIGKILL');
        }
      }, 2000);
    }

    if (cleanup) cleanup();
    activeDownloads.delete(url);

    res.json({ success: true, message: 'Download cancelled' });
  } else {
    res.status(404).json({ error: 'No active download found for this URL' });
  }
});

// Download video from supported platforms (YouTube, Instagram, Facebook, Twitter)
app.post('/api/download-video', async (req, res) => {
  const { url, filename, quality = 'maximum', sessionId, startTime, endTime } = req.body;

  console.log('🎬 SERVER DEBUG: Download request received', { url, filename, quality, sessionId, hasWebSocketConnection: wsConnections.has(sessionId) });
  console.log('🎬 SERVER DEBUG: Active WebSocket connections:', Array.from(wsConnections.keys()));

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate quality option
  if (!qualityFormats[quality]) {
    return res.status(400).json({ error: 'Invalid quality option' });
  }

  // Check if yt-dlp is available
  // Temporarily disabled to fix 500 error - yt-dlp should be available via nixpacks.toml
  // const ytDlpAvailable = await checkYtDlp();
  // if (!ytDlpAvailable) {
  //   return res.status(500).json({ 
  //     error: 'yt-dlp is not installed. Please install it with: pip install yt-dlp' 
  //   });
  // }

  let ytDlp = null;
  let tempDir = null;

  // Handle request cancellation
  const cleanup = () => {
    // Clear download timeout if it exists
    const downloadData = activeDownloads.get(url);
    if (downloadData && downloadData.timeout) {
      clearTimeout(downloadData.timeout);
    }

    if (ytDlp && !ytDlp.killed) {
      ytDlp.kill('SIGTERM');
      // Force kill if SIGTERM doesn't work
      setTimeout(() => {
        if (ytDlp && !ytDlp.killed) {
          ytDlp.kill('SIGKILL');
        }
      }, 5000);
    }
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up temp directory:', err);
      }
    }
    // Remove from active downloads
    activeDownloads.delete(url);
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);

  // Also check if request is already aborted
  if (req.aborted) {
    return;
  }

  try {
    // Create a temporary directory for downloads
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-'));
    const outputTemplate = path.join(tempDir, '%(title)s_%(id)s.%(ext)s');

    // For formats that download multiple files, use a more flexible template
    const flexibleTemplate = path.join(tempDir, '%(title)s_%(id)s_%(format_id)s.%(ext)s');

    // Detect platform and adjust settings accordingly
    const platform = detectPlatform(url);

    // Base arguments for all platforms
    const baseArgs = [
      '--restrict-filenames', // Use safe filenames
      '--embed-metadata',
      '--verbose',
      '--progress', // Enable progress output
      '--newline', // Each progress line on new line
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', // Latest Chrome
      '--extractor-args', 'youtube:player_client=web_creator,ios,web', // Prioritize Creator/iOS over standard Web
      '--js-runtimes', 'deno', // Use Deno for signature decryption (Node is unsupported/broken in current yt-dlp)
      '--no-check-formats', // Don't verify format availability
      '--no-check-certificate', // Bypass SSL certificate checks
      '--prefer-free-formats', // Prefer free formats when available
      '-S', 'vcodec:h264,res,acodec:m4a' // Explicitly sort to prefer H.264 video and AAC audio
    ];

    // Always add format for best quality first
    baseArgs.unshift('--format', qualityFormats[quality]);

    // Always use output template to ensure files go to tempDir
    baseArgs.unshift('--output', outputTemplate);

    // Add merge format for video qualities
    if (quality !== 'audio') {
      baseArgs.push('--merge-output-format', 'mp4');
    }

    // YouTube-specific bypass strategies
    if (platform === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      baseArgs.push(
        '--extractor-retries', '5', // Retry failed extractions
        '--fragment-retries', '10', // Retry failed fragments
        '--retry-sleep', 'exp=1:120', // Exponential backoff
        '--socket-timeout', '30', // Socket timeout
        '--http-chunk-size', '10485760', // 10MB chunks
        '--throttled-rate', '100K', // Rate limiting to avoid detection
        '--write-info-json', // Write metadata
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Sec-Fetch-Mode:navigate'
      );
    }

    // Store segment info for post-processing if needed
    let segmentInfo = null;
    if (startTime !== undefined && endTime !== undefined) {
      // Convert time format from MM:SS or HH:MM:SS to seconds if needed
      const parseTime = (timeStr) => {
        if (typeof timeStr === 'number') return timeStr;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) {
          return parts[0] * 60 + parts[1]; // MM:SS
        } else if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
        }
        return parseInt(timeStr) || 0;
      };

      const startSeconds = parseTime(startTime);
      const endSeconds = parseTime(endTime);
      const duration = endSeconds - startSeconds;

      segmentInfo = { startSeconds, duration };
      console.log('🎬 Segment info prepared:', segmentInfo);
      // Don't add ffmpeg args here - we'll process after download
    }

    // Platform-specific configurations
    if (platform === 'instagram') {
      // Instagram-specific arguments for carousel handling
      var ytDlpArgs = [
        ...baseArgs,
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', url,
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--retry-sleep', 'linear=1::2',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '--ignore-errors', // Continue on errors for individual items
        '--write-info-json', // Get metadata for each item
        '--write-thumbnail', // Download thumbnails
        // DO NOT add --no-playlist for Instagram to allow carousel downloads
        '--yes-playlist' // Explicitly enable playlist/carousel extraction
      ];

      // Try environment variable for explicit cookie file
      if (process.env.IG_COOKIES_FILE && fs.existsSync(process.env.IG_COOKIES_FILE)) {
        ytDlpArgs.push('--cookies', process.env.IG_COOKIES_FILE);
      } else {
        // Use alternative anti-bot measures for Instagram
        ytDlpArgs.push(
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          '--referer', 'https://www.instagram.com/'
        );
      }
    } else if (platform === 'facebook') {
      // Facebook-specific arguments  
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist', // For Facebook, use no-playlist
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', url,
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--retry-sleep', 'linear=1::2',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5'
      ];

      // Continue without authentication for Facebook
    } else if (platform === 'youtube') {
      // YouTube-specific arguments with advanced bypass strategies
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist',
        '--no-abort-on-error',
        '--ignore-errors'
      ];

      // Use cookies.txt file for YouTube authentication if available
      const cookiesPath = path.join(__dirname, 'cookies.txt');
      if (fs.existsSync(cookiesPath)) {
        ytDlpArgs.push('--cookies', cookiesPath);
        console.log('🍪 Using cookies.txt for YouTube authentication');
      } else {
        // Determine cookie source
        const cookieOptions = getCookiesPath();
        const usesBrowserCookies = cookieOptions.includes('--cookies-from-browser');

        // Auto-fallback: try extracting cookies into persistent jar locally, then use jar
        if (!isProductionEnvironment() && usesBrowserCookies) {
          try {
            console.log('🔁 Auto fallback: extracting YouTube cookies via headless browser...');
            await youtubeBypass.extractAndSaveCookies('https://www.youtube.com');
            if (fs.existsSync(youtubeBypass.cookieJar)) {
              ytDlpArgs.push('--cookies', youtubeBypass.cookieJar);
              console.log('🍪 Auto fallback successful: using persistent cookie jar');
            } else {
              ytDlpArgs.push(...cookieOptions);
              console.log('🍪 Using browser cookies for YouTube authentication');
            }
          } catch (error) {
            console.log('⚠️ Cookie extraction failed, falling back to browser cookies:', error.message);
            ytDlpArgs.push(...cookieOptions);
          }
        } else {
          // Use whatever getCookiesPath recommended (jar or browser)
          if (cookieOptions.length > 0) {
            ytDlpArgs.push(...cookieOptions);
            if (cookieOptions.includes('--cookies')) {
              console.log('🍪 Using persistent cookie jar for YouTube authentication');
            } else {
              console.log('🍪 Using browser cookies for YouTube authentication');
            }
          } else {
            console.log('⚠️ No cookies available, using basic anti-bot measures');
            ytDlpArgs.push(
              '--user-agent', getRandomUserAgent(),
              '--referer', 'https://www.youtube.com/'
            );
          }
        }
      }
    } else {
      // Default arguments for other platforms
      var ytDlpArgs = [
        ...baseArgs,
        '--no-playlist' // Default behavior for non-Instagram platforms
      ];
    }

    if (platform === 'twitter') {
      // Twitter-specific optimizations
      ytDlpArgs.push('--no-check-certificate');
    }

    if (platform === 'generic' || platform === 'direct-video') {
      // For generic websites, add more robust extraction options
      ytDlpArgs.push(
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--referer', url,
        '--extract-flat', 'false'
      );

      // For direct video files, try to download directly
      if (platform === 'direct-video') {
        ytDlpArgs.push('--no-playlist', '--ignore-errors');
      }
    }

    if (platform === 'reddit') {
      // Reddit-specific optimizations
      ytDlpArgs.push('--no-check-certificate');
    }

    // Segment trimming will be handled in post-processing with FFmpeg
    if (segmentInfo) {
      const startTime = segmentInfo.startSeconds;
      const endTime = startTime + segmentInfo.duration;
      console.log(`🎬 Segment download requested: ${startTime}-${endTime} seconds (will be trimmed in post-processing)`);
    }

    // Add merge format for video qualities
    if (quality !== 'audio') {
      ytDlpArgs.splice(2, 0, '--merge-output-format', 'mp4');
      ytDlpArgs.push('--write-thumbnail', '--embed-thumbnail');
    }

    ytDlpArgs.push(url);

    // Prepare command and arguments
    const ytDlpPath = await getYtDlpPath();

    // Handle the case where the path is actually a command with arguments (like "python3 -m yt_dlp")
    let command, commandArgs;

    if (ytDlpPath.includes(' ')) {
      const parts = ytDlpPath.split(' ');
      command = parts[0];
      commandArgs = [...parts.slice(1), ...ytDlpArgs];
    } else {
      command = ytDlpPath;
      commandArgs = ytDlpArgs;
    }

    console.log('🔍 DEBUG: Executing generic download:', command, commandArgs.join(' '));

    // Debug: Log the complete yt-dlp command
    console.log('🔍 DEBUG: Full yt-dlp command:', [command, ...commandArgs].join(' '));
    console.log('🔍 DEBUG: Quality requested:', quality);
    console.log('🔍 DEBUG: Format string:', qualityFormats[quality]);

    // For YouTube, use alternative format strategies for better quality control
    let attemptCount = 0;
    const maxAttempts = platform === 'youtube' ? alternativeFormats[quality]?.length || 1 : 1;

    const tryDownload = async (formatIndex = 0) => {
      attemptCount++;

      if (platform === 'youtube' && alternativeFormats[quality]) {
        // Always use alternative formats for YouTube to have better quality control
        const formatArgIndex = ytDlpArgs.findIndex(arg => arg === '--format');
        if (formatArgIndex !== -1 && formatArgIndex + 1 < ytDlpArgs.length) {
          ytDlpArgs[formatArgIndex + 1] = alternativeFormats[quality][formatIndex];
          console.log(`🔄 DEBUG: Using YouTube format ${formatIndex + 1}/${maxAttempts} for quality '${quality}':`, alternativeFormats[quality][formatIndex]);
        }
      }

      const ytDlpPath = await getYtDlpPath();
      let command, commandArgs;

      if (ytDlpPath.includes(' ')) {
        const parts = ytDlpPath.split(' ');
        command = parts[0];
        commandArgs = [...parts.slice(1), ...ytDlpArgs];
      } else {
        command = ytDlpPath;
        commandArgs = ytDlpArgs;
      }

      return spawn(command, commandArgs);
    };

    // Wrapper for retry capabilities
    const executeDownloadSession = async (isRetry = false) => {
      ytDlp = await tryDownload();

      // Update active download reference with new process
      if (activeDownloads.has(url)) {
        const ad = activeDownloads.get(url);
        if (ad) ad.ytDlp = ytDlp;
      }

      console.log('🎬 SERVER DEBUG: yt-dlp process started for sessionId:', sessionId);
      console.log('🎬 SERVER DEBUG: Process PID:', ytDlp.pid);

      // Add timeout mechanism to prevent hanging downloads
      const downloadTimeout = setTimeout(() => {
        console.error('⏰ Download timeout reached (5 minutes), killing yt-dlp process');
        if (ytDlp && !ytDlp.killed) {
          ytDlp.kill('SIGTERM');
          setTimeout(() => {
            if (ytDlp && !ytDlp.killed) {
              console.error('⏰ Force killing yt-dlp process with SIGKILL');
              ytDlp.kill('SIGKILL');
            }
          }, 5000); // Give 5 seconds for graceful termination
        }
        cleanup();
        if (!res.headersSent) {
          res.status(408).json({
            error: 'Download timeout',
            details: 'The download took too long and was cancelled. This may be due to network issues or the video being very large.'
          });
        }
      }, 5 * 60 * 1000); // 5 minutes timeout

      // Register this download in the active downloads map
      activeDownloads.set(url, { ytDlp, tempDir, cleanup, sessionId, timeout: downloadTimeout });

      let stderr = '';
      let stdout = '';
      let progressSent = false;

      // Unified progress tracking for multi-stage downloads
      let downloadStage = 'initializing'; // 'initializing', 'video', 'audio', 'merging', 'complete'
      let stageProgress = {}; // Track progress for each stage
      let lastUnifiedProgress = 0;

      // Stage weight mapping for unified progress calculation
      // Each stage represents the range it covers in the total progress
      const stageRanges = {
        initializing: { start: 0, end: 5 },      // 0-5%
        video: { start: 5, end: 55 },            // 5-55%
        audio: { start: 55, end: 80 },           // 55-80%
        merging: { start: 80, end: 95 },         // 80-95%
        postprocessing: { start: 95, end: 100 }  // 95-100%
      };

      const calculateUnifiedProgress = () => {
        // Calculate progress based on all completed stages plus current stage
        let totalProgress = 0;

        // Add progress from all completed stages
        for (const [stageName, progress] of Object.entries(stageProgress)) {
          const range = stageRanges[stageName];
          if (!range) continue;

          if (stageName === downloadStage) {
            // Current stage: interpolate within its range
            const rangeSize = range.end - range.start;
            totalProgress = range.start + (progress / 100) * rangeSize;
          } else if (progress >= 100) {
            // Completed stage: use its full range
            totalProgress = Math.max(totalProgress, range.end);
          }
        }

        // Round to whole number (no decimal places)
        totalProgress = Math.round(totalProgress);

        // Ensure progress stays within bounds and never goes backwards
        totalProgress = Math.min(100, Math.max(lastUnifiedProgress || 0, totalProgress));
        lastUnifiedProgress = totalProgress;

        return totalProgress;
      };

      const sendUnifiedProgress = (stage, rawProgress, details = {}) => {
        // Ensure rawProgress is a valid number and within bounds
        const validProgress = Math.max(0, Math.min(100, parseFloat(rawProgress) || 0));

        // When transitioning to a new stage, preserve completed stages
        if (stage !== downloadStage) {
          // Mark the previous stage as completed if it exists
          if (downloadStage && stageProgress[downloadStage] !== undefined) {
            stageProgress[downloadStage] = 100;
          }
          downloadStage = stage; // Update current stage
          // Initialize new stage progress if not exists
          if (stageProgress[stage] === undefined) {
            stageProgress[stage] = 0;
          }
        }

        // Update only the current stage progress
        const currentStageProgress = stageProgress[stage] || 0;
        stageProgress[stage] = validProgress;

        const unifiedProgress = calculateUnifiedProgress();

        // console.log(`📊 DEBUG: Stage '${stage}' progress: ${validProgress}% (was: ${currentStageProgress}%) -> Unified: ${unifiedProgress}%`);
        // console.log(`📊 DEBUG: Stage progress state:`, JSON.stringify(stageProgress));

        if (sessionId) {
          const operationKey = `download_${url}`;
          sendProgressUpdate(sessionId, operationKey, unifiedProgress, {
            ...details,
            stage: stage,
            stageProgress: validProgress,
            allStages: stageProgress
          });
        }
      };

      // Disable progress simulation - rely only on real yt-dlp progress
      // The simulation was interfering with real progress updates
      console.log('📊 DEBUG: Progress simulation disabled - using real yt-dlp progress only');

      // Send initial progress to show download has started
      if (sessionId) {
        sendUnifiedProgress('initializing', 0, { message: 'Starting download...' });
      }

      // Progress simulation removed - no cleanup needed

      // Periodically check if client is still connected
      const connectionCheck = setInterval(() => {
        if (res.destroyed || !res.writable) {
          clearInterval(connectionCheck);
          cleanup();
        }
      }, 1000); // Check every second

      // Clear interval when process completes
      const clearConnectionCheck = () => {
        clearInterval(connectionCheck);
      };

      ytDlp.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('🔍 DEBUG: yt-dlp stdout line:', JSON.stringify(output));

        // Parse progress from stdout as well
        if (sessionId) {
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              console.log('🔍 DEBUG: yt-dlp stdout line:', JSON.stringify(line));
            }

            // Look for download progress in stdout with improved patterns
            const progressMatch = line.match(/\[download\]\s*(\d+(?:\.\d+)?)%/) ||
              line.match(/\[download\].*?(\d+(?:\.\d+)?)%/) ||
              line.match(/(\d+(?:\.\d+)?)%\s*of\s*~?[\d.]+\w+/) ||
              line.match(/\s+(\d+(?:\.\d+)?)%\s+of\s+/) ||
              line.match(/\s+(\d+(?:\.\d+)?)%\s+at\s+/) ||
              line.match(/^\s*(\d+(?:\.\d+)?)%/);
            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              console.log('📊 DEBUG: Progress parsed from stdout:', progress + '% from line:', JSON.stringify(line));
              progressSent = true; // Mark that real progress was detected

              // Detect download stage from the line content with improved logic
              let stage = downloadStage; // Use current stage as default

              // Start with video stage when we first see download progress
              if (downloadStage === 'initializing' && progress > 0) {
                stage = 'video';
                downloadStage = 'video';
                console.log('📊 DEBUG: Transitioning from initializing to video stage');
              }
              // Audio detection - look for audio format indicators
              else if ((line.includes('format 140') || line.includes('m4a') || line.includes('audio only')) &&
                line.includes('[download]') && progress > 0) {
                if (downloadStage !== 'audio') {
                  stage = 'audio';
                  downloadStage = 'audio';
                  console.log('📊 DEBUG: Transitioning to audio stage');
                }
              }
              // Video detection - look for video format indicators  
              else if ((line.includes('format 137') || line.includes('format 136') ||
                line.includes('format 135') || line.includes('mp4') || line.includes('webm') ||
                line.includes('video only')) &&
                line.includes('[download]') && progress > 0) {
                if (downloadStage !== 'video' && downloadStage === 'initializing') {
                  stage = 'video';
                  downloadStage = 'video';
                  console.log('📊 DEBUG: Transitioning to video stage');
                }
              }
              // Merging stage detection
              else if (line.includes('Merging formats into') ||
                line.includes('[Merger]') ||
                line.includes('Merging') ||
                (line.includes('ffmpeg') && (line.includes('Merging') || line.includes('-c copy')))) {
                if (downloadStage !== 'merging') {
                  stage = 'merging';
                  downloadStage = 'merging';
                  console.log('📊 DEBUG: Transitioning to merging stage');
                  // Start merging with some initial progress
                  if (progress === 100) {
                    progress = 10;
                  }
                }
              }

              // Extract additional details
              const sizeMatch = line.match(/of\s*~?([\d.]+\w+)/) || line.match(/([\d.]+\w+)\s*total/);
              const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/) || line.match(/([\d.]+\w+\/s)/);
              const etaMatch = line.match(/ETA\s+(\d+:\d+)/) || line.match(/eta\s+(\d+:\d+)/i);

              sendUnifiedProgress(stage, progress, {
                size: sizeMatch ? sizeMatch[1] : null,
                speed: speedMatch ? speedMatch[1] : null,
                eta: etaMatch ? etaMatch[1] : null
              });
            }
          }
        }
      });

      ytDlp.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(output);

        // Parse progress from yt-dlp output
        if (sessionId) {
          const lines = output.split('\n');
          for (const line of lines) {
            // Debug: Log ALL stderr lines to see what yt-dlp is actually outputting
            if (line.trim()) {
              console.log('🔍 DEBUG: yt-dlp stderr line:', JSON.stringify(line));
            }

            // Debug: Log all lines that contain 'download' to see the actual format
            if (line.includes('[download]')) {
              console.log('🔍 DEBUG: yt-dlp download line:', JSON.stringify(line));
            }

            // Look for download progress with multiple possible formats:
            // [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:30
            // [download] 45.2% of ~123.45MiB at 1.23MiB/s ETA 00:30
            // [download]   45.2% of 123.45MiB at  1.23MiB/s ETA 00:30
            // Also look for any percentage pattern in case format changed
            const progressMatch = line.match(/\[download\]\s*(\d+(?:\.\d+)?)%/) ||
              line.match(/\[download\].*?(\d+(?:\.\d+)?)%/) ||
              line.match(/(\d+(?:\.\d+)?)%\s*of\s*~?[\d.]+\w+/) ||
              line.match(/\s+(\d+(?:\.\d+)?)%\s+of\s+/) ||
              line.match(/\s+(\d+(?:\.\d+)?)%\s+at\s+/) ||
              line.match(/^\s*(\d+(?:\.\d+)?)%/);
            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              console.log('📊 DEBUG: Progress parsed from stderr:', progress + '% from line:', JSON.stringify(line));
              progressSent = true; // Mark that real progress was detected

              // Detect download stage from the line content with improved logic
              let stage = downloadStage; // Use current stage as default

              // Start with video stage when we first see download progress
              if (downloadStage === 'initializing' && progress > 0) {
                stage = 'video';
                downloadStage = 'video';
                console.log('📊 DEBUG: Transitioning from initializing to video stage (stderr)');
              }
              // Audio detection - look for audio format indicators
              else if ((line.includes('format 140') || line.includes('m4a') || line.includes('audio only')) &&
                line.includes('[download]') && progress > 0) {
                if (downloadStage !== 'audio') {
                  stage = 'audio';
                  downloadStage = 'audio';
                  console.log('📊 DEBUG: Transitioning to audio stage (stderr)');
                }
              }
              // Video detection - look for video format indicators  
              else if ((line.includes('format 137') || line.includes('format 136') ||
                line.includes('format 135') || line.includes('mp4') || line.includes('webm') ||
                line.includes('video only')) &&
                line.includes('[download]') && progress > 0) {
                if (downloadStage !== 'video' && downloadStage === 'initializing') {
                  stage = 'video';
                  downloadStage = 'video';
                  console.log('📊 DEBUG: Transitioning to video stage (stderr)');
                }
              }
              // Merging stage detection
              else if (line.includes('Merging formats into') ||
                line.includes('[Merger]') ||
                line.includes('Merging') ||
                (line.includes('ffmpeg') && (line.includes('Merging') || line.includes('-c copy')))) {
                if (downloadStage !== 'merging') {
                  stage = 'merging';
                  downloadStage = 'merging';
                  console.log('📊 DEBUG: Transitioning to merging stage (stderr)');
                  // Start merging with some initial progress
                  if (progress === 100) {
                    progress = 10;
                  }
                }
              }

              // Extract additional details with more flexible patterns
              const sizeMatch = line.match(/of\s*~?([\d.]+\w+)/) || line.match(/([\d.]+\w+)\s*total/);
              const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/) || line.match(/([\d.]+\w+\/s)/);
              const etaMatch = line.match(/ETA\s+(\d+:\d+)/) || line.match(/eta\s+(\d+:\d+)/i);

              console.log('📡 DEBUG: Sending unified progress update via WebSocket');
              sendUnifiedProgress(stage, progress, {
                size: sizeMatch ? sizeMatch[1] : null,
                speed: speedMatch ? speedMatch[1] : null,
                eta: etaMatch ? etaMatch[1] : null
              });
            }
          }
        }
      });

      ytDlp.on('close', async (code) => {
        clearConnectionCheck();
        // Clear download timeout
        const downloadData = activeDownloads.get(url);
        if (downloadData && downloadData.timeout) {
          clearTimeout(downloadData.timeout);
        }
        // Progress simulation removed - no cleanup needed

        // Handle Instagram/Facebook authentication failures with helpful error messages
        if (code !== 0 && (platform === 'instagram' || platform === 'facebook')) {
          const errorOutput = stderr.toLowerCase();
          if (errorOutput.includes('login required') || errorOutput.includes('authentication') ||
            errorOutput.includes('cookies') || errorOutput.includes('rate-limit')) {
            fs.rmSync(tempDir, { recursive: true, force: true });

            const isProduction = isProductionEnvironment();
            const errorMessage = isProduction
              ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} authentication not available in production`
              : `${platform.charAt(0).toUpperCase() + platform.slice(1)} requires authentication`;

            const details = isProduction
              ? `Instagram downloads require browser cookies which are not available on the production server. This is a limitation of the hosting environment. Try:
1. Using a public Instagram post URL (some may work without authentication)
2. Running the application locally for Instagram downloads
3. Using alternative platforms like YouTube, TikTok, or Twitter`
              : `This ${platform} content requires login. The platform has restricted access to prevent automated downloads. Try:
1. Using a public post URL instead of private content
2. Checking if the content is publicly accessible
3. The content may be geo-restricted or require account access`;

            return res.status(403).json({
              error: errorMessage,
              details: details,
              platform: platform,
              isProduction: isProduction,
              suggestion: 'Try downloading from YouTube, TikTok, or Twitter instead, which work more reliably.'
            });
          }
        }

        if (code === 0) {
          // Send gradual merging progress updates before completion
          if (sessionId) {
            console.log('✅ Download completed successfully - sending gradual merging progress');
            console.log('📊 DEBUG: Current merging progress before gradual updates:', stageProgress.merging);
            // Send intermediate merging progress to avoid sudden jumps
            if (!stageProgress.merging || stageProgress.merging < 50) {
              console.log('📊 DEBUG: Sending merging progress 50%');
              sendUnifiedProgress('merging', 50, { stage: 'Processing downloaded files' });
              await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for smooth progress
            }
            if (!stageProgress.merging || stageProgress.merging < 80) {
              console.log('📊 DEBUG: Sending merging progress 80%');
              sendUnifiedProgress('merging', 80, { stage: 'Finalizing merge' });
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            console.log('📊 DEBUG: Sending merging progress 100%');
            sendUnifiedProgress('merging', 100, { stage: 'Merge completed' });
            await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause before post-processing
          }

          // Find the downloaded files (handle carousel posts with multiple files)
          let files = fs.readdirSync(tempDir).filter(file =>
            // Filter out info.json files and thumbnails, keep media files
            !/\.(info\.json|description|annotations\.xml)$/i.test(file) &&
            !/thumbnail/i.test(file)
          );

          if (files.length > 0) {
            // Always start post-processing stage to ensure progress doesn't reach 100% prematurely
            console.log('🔄 Starting post-processing stage...');
            sendUnifiedProgress('postprocessing', 10, { stage: 'Post-processing files' });

            // Handle segment trimming if needed
            console.log('🔍 Checking segment trimming:', { segmentInfo, filesCount: files.length });
            if (segmentInfo) {
              // Find the video file among downloaded files
              const videoFile = files.find(file => /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(file));
              console.log('📹 Processing video for trimming:', { videoFile, allFiles: files });

              if (videoFile) {
                const originalPath = path.join(tempDir, videoFile);
                const isVideo = true; // We already confirmed it's a video file

                if (isVideo) {
                  const ext = path.extname(videoFile);
                  const baseName = path.basename(videoFile, ext);
                  const trimmedFile = `${baseName}_trimmed${ext}`;
                  const trimmedPath = path.join(tempDir, trimmedFile);

                  try {
                    // First, get video duration using ffprobe
                    console.log('🔍 Checking video duration with ffprobe...');
                    const ffprobeArgs = ['-v', 'quiet', '-print_format', 'json', '-show_format', originalPath];
                    const ffprobe = spawn('ffprobe', ffprobeArgs);

                    let ffprobeOutput = '';
                    ffprobe.stdout.on('data', (data) => {
                      ffprobeOutput += data.toString();
                    });

                    await new Promise((resolve, reject) => {
                      ffprobe.on('close', (code) => {
                        if (code === 0) {
                          try {
                            const probeData = JSON.parse(ffprobeOutput);
                            const videoDuration = parseFloat(probeData.format.duration);
                            console.log(`📏 Video duration: ${videoDuration} seconds`);
                            console.log(`⏰ Requested start: ${segmentInfo.startSeconds}s, duration: ${segmentInfo.duration}s`);

                            if (segmentInfo.startSeconds >= videoDuration) {
                              throw new Error(`Start time (${segmentInfo.startSeconds}s) is beyond video duration (${videoDuration}s)`);
                            }

                            if (segmentInfo.startSeconds + segmentInfo.duration > videoDuration) {
                              const adjustedDuration = videoDuration - segmentInfo.startSeconds;
                              console.log(`⚠️ Adjusting duration from ${segmentInfo.duration}s to ${adjustedDuration}s to fit video length`);
                              segmentInfo.duration = adjustedDuration;
                            }

                            resolve();
                          } catch (parseError) {
                            reject(new Error(`Failed to parse ffprobe output: ${parseError.message}`));
                          }
                        } else {
                          reject(new Error(`ffprobe failed with code ${code}`));
                        }
                      });
                    });

                    // Use ffmpeg to trim the video with stream copying to preserve quality
                    // Use input seeking for better stream copy compatibility
                    const ffmpegArgs = [
                      '-ss', segmentInfo.startSeconds.toString(), // Seek before input for better stream copy
                      '-i', originalPath,
                      '-t', segmentInfo.duration.toString(),
                      '-c', 'copy', // Copy streams without re-encoding to preserve quality
                      '-avoid_negative_ts', 'make_zero',
                      '-map_metadata', '0', // Copy metadata
                      '-y', // Overwrite output file
                      trimmedPath
                    ];

                    // Fallback args with re-encoding if stream copy fails
                    const fallbackArgs = [
                      '-ss', segmentInfo.startSeconds.toString(), // Input seeking for consistency
                      '-i', originalPath,
                      '-t', segmentInfo.duration.toString(),
                      '-c:v', 'libx264', // Re-encode video as fallback
                      '-c:a', 'aac', // Re-encode audio as fallback
                      '-preset', 'medium', // Better quality preset
                      '-crf', '15', // Very high quality encoding (lower = better)
                      '-profile:v', 'high', // High profile for better quality
                      '-level', '4.1', // Compatibility level
                      '-pix_fmt', 'yuv420p', // Ensure compatible pixel format
                      '-avoid_negative_ts', 'make_zero',
                      '-map_metadata', '0', // Copy metadata
                      '-y', // Overwrite output file
                      trimmedPath
                    ];

                    // Function to try FFmpeg with given arguments
                    const tryFFmpeg = (args, description) => {
                      return new Promise((resolve, reject) => {
                        console.log(`⚡ Starting ffmpeg ${description} with args:`, args);
                        const ffmpeg = spawn('ffmpeg', args);

                        let ffmpegStderr = '';
                        let duration = null;

                        ffmpeg.stderr.on('data', (data) => {
                          const stderrLine = data.toString();
                          ffmpegStderr += stderrLine;
                          console.log('🔍 FFmpeg stderr:', stderrLine.trim());

                          // Parse duration from FFmpeg output
                          const durationMatch = stderrLine.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                          if (durationMatch && !duration) {
                            const hours = parseInt(durationMatch[1]);
                            const minutes = parseInt(durationMatch[2]);
                            const seconds = parseInt(durationMatch[3]);
                            duration = hours * 3600 + minutes * 60 + seconds;
                            console.log('📏 FFmpeg detected duration:', duration, 'seconds');
                          }

                          // Parse progress from FFmpeg output
                          const timeMatch = stderrLine.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                          if (timeMatch && duration) {
                            const hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            const seconds = parseInt(timeMatch[3]);
                            const currentTime = hours * 3600 + minutes * 60 + seconds;
                            const progress = Math.min(Math.round((currentTime / duration) * 80) + 10, 90); // 10-90% range
                            sendUnifiedProgress('postprocessing', progress, { stage: 'FFmpeg processing', currentTime, duration });
                          }
                        });

                        ffmpeg.stdout.on('data', (data) => {
                          console.log('📺 FFmpeg stdout:', data.toString().trim());
                        });

                        // Set a timeout for FFmpeg process (30 seconds)
                        const timeout = setTimeout(() => {
                          ffmpeg.kill('SIGKILL');
                          reject(new Error(`FFmpeg ${description} timeout after 30 seconds`));
                        }, 30000);

                        ffmpeg.on('close', (ffmpegCode) => {
                          clearTimeout(timeout);
                          if (ffmpegCode === 0) {
                            resolve();
                          } else {
                            reject(new Error(`FFmpeg ${description} failed with code ${ffmpegCode}. Stderr: ${ffmpegStderr}`));
                          }
                        });
                      });
                    };

                    // Start post-processing stage
                    console.log('🔄 Starting post-processing (trimming)...');
                    sendUnifiedProgress('postprocessing', 10, { stage: 'Starting FFmpeg trimming' });

                    // Use only stream copying to preserve original quality exactly
                    let ffmpegSuccess = false;
                    try {
                      await tryFFmpeg(ffmpegArgs, 'stream copy (preserving original quality)');
                      ffmpegSuccess = true;
                      console.log('✅ Stream copy successful - original quality preserved exactly');
                    } catch (streamCopyError) {
                      throw new Error(`Stream copy failed: ${streamCopyError.message}. Original quality cannot be preserved with re-encoding.`);
                    }

                    if (ffmpegSuccess) {
                      // Wait a moment for file system to sync
                      await new Promise(resolve => setTimeout(resolve, 100));

                      // Check if trimmed file exists and get its size
                      if (!fs.existsSync(trimmedPath)) {
                        throw new Error(`Trimmed file not found: ${trimmedPath}`);
                      }

                      const trimmedStats = fs.statSync(trimmedPath);
                      console.log('📊 Trimmed file size:', trimmedStats.size, 'bytes');

                      // Verify trimmed file is not empty or too small
                      if (trimmedStats.size < 10000) { // Less than 10KB is suspicious
                        console.warn('⚠️ Trimmed file seems too small, continuing anyway');
                      }

                      // Replace original file with trimmed version
                      if (fs.existsSync(originalPath)) {
                        fs.unlinkSync(originalPath);
                        console.log('🗑️ Deleted original file:', originalPath);
                      }

                      // Move trimmed file to original location to maintain file serving logic
                      fs.renameSync(trimmedPath, originalPath);
                      console.log('📁 Moved trimmed file to:', originalPath);

                      // Verify the moved file
                      const finalStats = fs.statSync(originalPath);
                      console.log('✅ Final file size:', finalStats.size, 'bytes');

                      if (finalStats.size !== trimmedStats.size) {
                        throw new Error(`File size mismatch after move: expected ${trimmedStats.size}, got ${finalStats.size}`);
                      }

                      console.log('✅ FFmpeg trimming completed successfully');

                      // FFmpeg trimming completed, but don't mark as 100% yet - wait for file serving
                      sendUnifiedProgress('postprocessing', 90, { stage: 'FFmpeg trimming completed, preparing file' });
                    }
                  } catch (error) {
                    console.error('FFmpeg trimming failed:', error);
                    // Continue with original file if trimming fails
                  }
                }
              } else {
                // No segment trimming needed, but don't mark as 100% yet - wait for file serving
                console.log('✅ Post-processing completed (no trimming required)');
                sendUnifiedProgress('postprocessing', 90, { stage: 'Post-processing completed, preparing file' });
              }
            }

            // Sort files to prioritize videos over images
            const sortedFiles = files.sort((a, b) => {
              const aIsVideo = /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(a);
              const bIsVideo = /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(b);
              if (aIsVideo && !bIsVideo) return -1;
              if (!aIsVideo && bIsVideo) return 1;
              return a.localeCompare(b);
            });

            // If multiple files (carousel post), create a zip archive
            // Also check for images in case of Instagram mixed content
            if (files.length > 1 && platform === 'instagram') {

              const zipFilename = `${filename || 'instagram_carousel'}.zip`;
              res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
              res.setHeader('Content-Type', 'application/zip');

              const archive = archiver('zip', { zlib: { level: 9 } });

              // Handle client disconnect
              res.on('close', () => {
                archive.destroy();
                // We don't delete tempDir here immediately as 'end' or 'error' will handle it, 
                // or the main flow might if we aren't careful. 
                // But generally safe to rely on end/error/aborted logic.
              });

              // Handle archive warnings/errors
              archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                  console.warn('Archive warning:', err);
                } else {
                  console.error('Archive error/warning:', err);
                }
              });

              archive.on('error', (err) => {
                console.error('Archive CRITICAL error:', err);
                if (!res.headersSent) {
                  res.status(500).json({ error: 'Failed to create archive' });
                }
                fs.rmSync(tempDir, { recursive: true, force: true });
              });

              // Track archive streaming progress
              let archiveBytesStreamed = 0;

              archive.on('data', (chunk) => {
                archiveBytesStreamed += chunk.length;
                const streamProgress = Math.min(95, 10 + (archiveBytesStreamed / (1024 * 1024)) * 0.5); // Gradual progress
                sendUnifiedProgress('postprocessing', streamProgress, {
                  stage: `Streaming archive (${Math.round(archiveBytesStreamed / 1024 / 1024)}MB)`
                });
              });

              // Pipe archive to response
              archive.pipe(res);

              // Add files to archive
              sortedFiles.forEach((file, index) => {
                const filePath = path.join(tempDir, file);
                const ext = path.extname(file);
                const baseName = path.basename(file, ext);
                // Create meaningful names for carousel items
                const archiveName = `carousel_item_${index + 1}_${baseName}${ext}`;
                archive.file(filePath, { name: archiveName });
              });

              // Finalize archive
              archive.finalize();

              // Clean up after sending
              archive.on('end', () => {
                console.log('✅ Archive streaming completed successfully');
                sendUnifiedProgress('postprocessing', 100, { stage: 'Download completed', completed: true });
                fs.rmSync(tempDir, { recursive: true, force: true });
              });

            } else {
              // Single file - send as normal
              const downloadedFile = path.join(tempDir, sortedFiles[0]);

              // Check if file exists, if not it might be a trimmed file issue
              if (!fs.existsSync(downloadedFile)) {
                console.error('❌ File not found:', downloadedFile);
                console.log('📁 Available files in temp dir:', fs.readdirSync(tempDir));
                fs.rmSync(tempDir, { recursive: true, force: true });
                return res.status(500).json({ error: 'Processed file not found' });
              }

              const stats = fs.statSync(downloadedFile);
              console.log('📤 Serving file:', downloadedFile, 'Size:', stats.size, 'bytes');

              // Send file as download
              const finalFilename = filename || sortedFiles[0];
              // Properly encode filename for Content-Disposition header - sanitize all non-ASCII and special characters
              const sanitizedFilename = finalFilename.replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_');
              const encodedFilename = encodeURIComponent(sanitizedFilename).replace(/'/g, '%27');
              res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}; filename="${sanitizedFilename}"`);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', stats.size);

              const fileStream = fs.createReadStream(downloadedFile);
              let bytesStreamed = 0;
              const totalSize = stats.size;

              // Handle client disconnect during file streaming
              res.on('close', () => {
                fileStream.destroy();
                fs.rmSync(tempDir, { recursive: true, force: true });
              });

              // Track streaming progress
              fileStream.on('data', (chunk) => {
                bytesStreamed += chunk.length;
                const streamProgress = Math.min(95, 10 + (bytesStreamed / totalSize) * 85); // 10% to 95%
                sendUnifiedProgress('postprocessing', streamProgress, {
                  stage: `Streaming file (${Math.round(bytesStreamed / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB)`
                });
              });

              fileStream.pipe(res);

              // Clean up after sending
              fileStream.on('end', () => {
                console.log('✅ File streaming completed successfully');
                sendUnifiedProgress('postprocessing', 100, { stage: 'Download completed', completed: true });
                fs.rmSync(tempDir, { recursive: true, force: true });
              });

              fileStream.on('error', (error) => {
                console.error('File stream error:', error);
                fs.rmSync(tempDir, { recursive: true, force: true });
                if (!res.headersSent) {
                  res.status(500).json({ error: 'Failed to send file' });
                }
              });
            }
          } else {
            fs.rmSync(tempDir, { recursive: true, force: true });
            res.status(500).json({ error: 'No file was downloaded' });
          }
        } else {
          fs.rmSync(tempDir, { recursive: true, force: true });

          // Handle YouTube authentication issues specifically
          const errorOutput = (stderr || stdout || '').toLowerCase();

          // Check for YouTube authentication/Geo-lock issues
          const isAuthError = platform === 'youtube' && (
            errorOutput.includes('login_required') ||
            errorOutput.includes('sign in to confirm') ||
            errorOutput.includes('please sign in') ||
            errorOutput.includes('cookies-from-browser') ||
            errorOutput.includes('authentication')
          );

          const usedCookies = ytDlpArgs.includes('--cookies');

          // RETRY LOGIC: If auth failed with cookies, try without
          if (isAuthError && usedCookies && !isRetry) {
            console.log('⚠️ YouTube authentication failed (Geo-lock). Retrying WITHOUT cookies...');
            sendUnifiedProgress('video', 0, { message: 'Authentication rejected. Retrying public access...' });

            // Remove --cookies and its value
            const cookieIndex = ytDlpArgs.indexOf('--cookies');
            if (cookieIndex !== -1) {
              ytDlpArgs.splice(cookieIndex, 2);
            }

            // Also remove --extractor-args to revert to default (safest for public)
            const extractorIndex = ytDlpArgs.indexOf('--extractor-args');
            if (extractorIndex !== -1) {
              ytDlpArgs.splice(extractorIndex, 2);
            }

            // Cleanup old temp dir
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }

            // New temp dir for retry
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-retry-'));

            // Update --output path in args
            const outputIndex = ytDlpArgs.indexOf('--output');
            if (outputIndex !== -1) {
              ytDlpArgs[outputIndex + 1] = path.join(tempDir, '%(title)s_%(id)s.%(ext)s');
            }

            // Recursively call execution with retry flag
            return executeDownloadSession(true);
          }

          // Standard 403 Response if not retrying or retry failed
          if (isAuthError) {
            const msg = isRetry ? 'YouTube authentication required (Retry failed)' : 'YouTube authentication required';
            const details = isRetry
              ? 'Both authenticated (cookie) and public (no-cookie) access attempts failed. The video is likely strictly age-gated or premium-only.'
              : 'YouTube is blocking downloads from this server due to anti-bot measures.';

            return res.status(403).json({
              error: msg,
              details: details,
              platform: 'youtube',
              isProduction: isProductionEnvironment(),
              suggestion: 'Try using fresh cookies exported from a US IP address, or use a Proxy.',
              technicalDetails: stderr || stdout
            });
          }

          res.status(500).json({
            error: `yt-dlp failed with code ${code}`,
            details: stderr || stdout,
            platform: platform
          });
        }
      });

      ytDlp.on('error', (error) => {
        clearConnectionCheck();
        // Clear download timeout
        const downloadData = activeDownloads.get(url);
        if (downloadData && downloadData.timeout) {
          clearTimeout(downloadData.timeout);
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to start yt-dlp',
            details: error.message
          });
        }
      });

    }; // End executeDownloadSession

    // Start the download process
    await executeDownloadSession();

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Download direct media (images, videos, etc.) with CORS proxy
app.post('/api/download-direct', async (req, res) => {
  const { url, filename } = req.body;

  if (!url || !filename) {
    return res.status(400).json({ error: 'URL and filename are required' });
  }

  try {
    // Try direct download first
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
    } catch (error) {
      // If direct download fails, try CORS proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      response = await fetch(proxyUrl);
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Set appropriate headers for file download
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the response to client
    response.body.pipe(res);

  } catch (error) {
    console.error('Direct download error:', error);
    res.status(500).json({
      error: 'Failed to download file',
      details: error.message
    });
  }
});

// Download blob video (for blob URLs)
app.post('/api/download-blob', async (req, res) => {
  const { url, filename } = req.body;

  if (!url || !filename) {
    return res.status(400).json({ error: 'URL and filename are required' });
  }

  // For blob URLs, we can't download them server-side since they're client-side only
  // Return an error with instructions
  res.status(400).json({
    error: 'Blob URLs cannot be downloaded server-side',
    details: 'Blob URLs are client-side only and must be handled in the browser',
    suggestion: 'This type of media should be downloaded directly in the browser'
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const ytDlpAvailable = await checkYtDlpAvailability();

  // Get yt-dlp version if available
  let ytDlpVersion = 'unknown';
  let activePath = 'unknown';
  if (ytDlpAvailable) {
    try {
      activePath = await getYtDlpPath();
      const { stdout } = await execPromise(`${activePath} --version`);
      ytDlpVersion = stdout.trim();
    } catch (e) {
      ytDlpVersion = 'error retrieving version';
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      has_cookies: !!(process.env.YT_COOKIES || process.env.YOUTUBE_COOKIES || process.env.YT_COOKIES_BASE64),
      has_proxies: !!(process.env.US_PROXY_1 || process.env.BRIGHTDATA_US_1),
      platform: process.platform,
      backend_url: process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'localhost'
    },
    yt_dlp: {
      available: ytDlpAvailable,
      path: activePath,
      version: ytDlpVersion
    },
    message: ytDlpAvailable ? 'yt-dlp is available' : 'yt-dlp is not installed',
    bypassFeatures: {
      advancedFingerprinting: true,
      sessionPersistence: true,
      browserAutomation: true,
      cookieExtraction: true,
      proxyRotation: !!process.env.HTTP_PROXY,
      multiClientStrategies: true
    }
  });
});

// Manual cookie extraction endpoint for YouTube bypass
app.post('/api/extract-cookies', async (req, res) => {
  try {
    console.log('Manual cookie extraction requested');
    await youtubeBypass.extractAndSaveCookies('https://www.youtube.com');
    res.json({
      success: true,
      message: 'Cookies extracted successfully. This will improve YouTube access for future requests.',
      cookieJarPath: youtubeBypass.cookieJar
    });
  } catch (error) {
    console.error('Manual cookie extraction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cookie extraction failed',
      details: error.message
    });
  }
});

// Bypass system status endpoint
app.get('/api/bypass-status', (req, res) => {
  const sessionCount = youtubeBypass.sessionCache.size;
  const cookieExists = fs.existsSync(youtubeBypass.cookieJar);

  res.json({
    sessionCache: {
      activeSessions: sessionCount,
      maxAge: '5 minutes'
    },
    cookies: {
      available: cookieExists,
      path: youtubeBypass.cookieJar,
      lastModified: cookieExists ? fs.statSync(youtubeBypass.cookieJar).mtime : null
    },
    proxies: {
      configured: !!process.env.HTTP_PROXY || !!process.env.HTTPS_PROXY || !!process.env.SOCKS_PROXY,
      httpProxy: !!process.env.HTTP_PROXY,
      httpsProxy: !!process.env.HTTPS_PROXY,
      socksProxy: !!process.env.SOCKS_PROXY
    },
    requestStats: {
      totalRequests: youtubeBypass.requestCount,
      lastRequestTime: youtubeBypass.lastRequestTime
    }
  });
});

// Performance monitoring endpoint
app.get('/api/performance', (req, res) => {
  try {
    const metrics = youtubeBypass.getPerformanceMetrics();
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    };

    res.json({
      status: 'success',
      data: {
        bypassMetrics: metrics,
        systemInfo: systemInfo,
        proxyStatus: {
          enabled: youtubeBypass.proxyList && youtubeBypass.proxyList.length > 0,
          count: youtubeBypass.proxyList ? youtubeBypass.proxyList.length : 0,
          currentIndex: youtubeBypass.currentProxyIndex || 0
        },
        cookieStatus: {
          enabled: youtubeBypass.cookieRotation && youtubeBypass.cookieRotation.length > 0,
          count: youtubeBypass.cookieRotation ? youtubeBypass.cookieRotation.length : 0,
          currentIndex: youtubeBypass.currentCookieIndex || 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting performance metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

// Advanced monitoring dashboard endpoint
app.get('/api/dashboard', (req, res) => {
  try {
    const metrics = youtubeBypass.getPerformanceMetrics();
    const now = Date.now();

    // Calculate additional dashboard metrics
    const recentRequests = (youtubeBypass.requestHistory || []).filter(req => req.timestamp > now - 3600000);
    const recentFailures = (youtubeBypass.failureHistory || []).filter(fail => fail.timestamp > now - 3600000);

    // Failure type distribution
    const failureDistribution = {};
    recentFailures.forEach(fail => {
      failureDistribution[fail.type] = (failureDistribution[fail.type] || 0) + 1;
    });

    // Request pattern analysis
    const hourlyPattern = {};
    recentRequests.forEach(req => {
      const hour = new Date(req.timestamp).getHours();
      hourlyPattern[hour] = (hourlyPattern[hour] || 0) + 1;
    });

    // Performance trends
    const avgDelayTrend = recentRequests.length > 0 ?
      recentRequests.reduce((sum, req) => sum + (req.delay || 0), 0) / recentRequests.length : 0;

    const dashboard = {
      overview: {
        totalRequests: recentRequests.length,
        totalFailures: recentFailures.length,
        successRate: recentRequests.length > 0 ?
          ((recentRequests.length - recentFailures.length) / recentRequests.length * 100).toFixed(1) + '%' : 'N/A',
        avgResponseDelay: Math.round(avgDelayTrend / 1000) + 's',
        circuitBreakerStatus: youtubeBypass.isCircuitBreakerActive() ? 'ACTIVE' : 'INACTIVE',
        adaptiveMultiplier: (youtubeBypass.adaptiveMultiplier || 1.0).toFixed(2) + 'x'
      },
      metrics: metrics,
      analysis: {
        failureDistribution: failureDistribution,
        hourlyRequestPattern: hourlyPattern,
        peakHour: Object.keys(hourlyPattern).reduce((a, b) => hourlyPattern[a] > hourlyPattern[b] ? a : b, '0'),
        consecutiveFailures: youtubeBypass.consecutiveFailures || 0,
        lastSuccessTime: youtubeBypass.lastSuccessTime ?
          new Date(youtubeBypass.lastSuccessTime).toISOString() : 'Never'
      },
      recommendations: generateRecommendations(metrics, failureDistribution, recentRequests.length)
    };

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: dashboard
    });
  } catch (error) {
    console.error('❌ Error generating dashboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate dashboard',
      error: error.message
    });
  }
});

// Generate intelligent recommendations based on performance data
function generateRecommendations(metrics, failureDistribution, requestCount) {
  const recommendations = [];

  // Success rate recommendations
  const successRate = parseFloat(metrics['15min'].successRate) || 0;
  if (successRate < 50) {
    recommendations.push({
      type: 'critical',
      category: 'success_rate',
      message: 'Success rate is critically low. Consider enabling more proxies or reducing request frequency.',
      action: 'Enable proxy rotation and increase delays'
    });
  } else if (successRate < 80) {
    recommendations.push({
      type: 'warning',
      category: 'success_rate',
      message: 'Success rate could be improved. Review failure patterns and adjust strategies.',
      action: 'Analyze failure types and optimize accordingly'
    });
  }

  // Failure pattern recommendations
  if (failureDistribution['bot_detection'] > 3) {
    recommendations.push({
      type: 'critical',
      category: 'bot_detection',
      message: 'High bot detection rate. Implement better user agent rotation and request patterns.',
      action: 'Enable mobile emulation and vary request timing'
    });
  }

  if (failureDistribution['rate_limit'] > 5) {
    recommendations.push({
      type: 'warning',
      category: 'rate_limiting',
      message: 'Frequent rate limiting detected. Increase delays between requests.',
      action: 'Reduce request frequency and implement longer delays'
    });
  }

  // Request volume recommendations
  if (requestCount > 100) {
    recommendations.push({
      type: 'info',
      category: 'volume',
      message: 'High request volume detected. Monitor for potential rate limiting.',
      action: 'Consider implementing request queuing'
    });
  }

  // Circuit breaker recommendations
  if (metrics.circuitBreakerActive) {
    recommendations.push({
      type: 'warning',
      category: 'circuit_breaker',
      message: 'Circuit breaker is active. System is in protective mode.',
      action: 'Wait for recovery or investigate underlying issues'
    });
  }

  // Performance recommendations
  const avgDelay = parseInt(metrics['15min'].avgDelay) || 0;
  if (avgDelay > 30) {
    recommendations.push({
      type: 'info',
      category: 'performance',
      message: 'Average delays are high. System is being conservative.',
      action: 'Monitor success rates and consider optimizing if stable'
    });
  }

  return recommendations;
}

// Get video information (duration, title, etc.) without downloading
app.post('/api/video-info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Check if yt-dlp is available
  // Temporarily disabled to fix 500 error - yt-dlp should be available via nixpacks.toml
  // const ytDlpAvailable = await checkYtDlp();
  // if (!ytDlpAvailable) {
  //   return res.status(500).json({ 
  //     error: 'yt-dlp is not installed. Please install it with: pip install yt-dlp' 
  //   });
  // }

  try {
    // Use yt-dlp to dump JSON only; avoid forcing a format during info retrieval
    const ytDlpArgs = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--socket-timeout', '15',
      '--extractor-retries', '1'
    ];

    // Use Web Creator/iOS client to allow cookies to work properly and bypass blocks
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('YouTube URL detected; preferring Web Creator/iOS client and checking cookies');

      // Attempt to resolve cookies path robustly for Railway (/app is working dir)
      const localCookiesPath = path.resolve('.cookies/accounts/default.txt');
      if (fs.existsSync(localCookiesPath)) {
        ytDlpArgs.push('--cookies', localCookiesPath);
        console.log('🍪 Using cookies for video info:', localCookiesPath);
      } else if (process.env.YOUTUBE_COOKIES_PATH && fs.existsSync(process.env.YOUTUBE_COOKIES_PATH)) {
        ytDlpArgs.push('--cookies', process.env.YOUTUBE_COOKIES_PATH);
        console.log('🍪 Using cookies from env for video info:', process.env.YOUTUBE_COOKIES_PATH);
      }

      // Use Web Creator/iOS client
      ytDlpArgs.push('--extractor-args', 'youtube:player_client=web_creator,ios,web');
    }

    ytDlpArgs.push(url);

    const ytDlpPath = await getYtDlpPath();
    let command, commandArgs;
    if (ytDlpPath.includes(' ')) {
      const parts = ytDlpPath.split(' ');
      command = parts[0];
      commandArgs = [...parts.slice(1), ...ytDlpArgs];
    } else {
      command = ytDlpPath;
      commandArgs = ytDlpArgs;
    }

    const ytDlp = spawn(command, commandArgs);
    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set a timeout for the entire operation (20 seconds)
    const timeout = setTimeout(() => {
      if (!isResolved) {
        console.log('Video info request timed out, killing yt-dlp process');
        ytDlp.kill('SIGKILL');
        isResolved = true;
        res.status(408).json({
          error: 'Request timeout - video analysis took too long',
          details: 'The video analysis process exceeded the time limit. This may happen with very large videos or slow network connections.'
        });
      }
    }, 20000); // 20 second timeout

    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytDlp.on('close', async (code) => {
      if (isResolved) {
        return; // Already handled by timeout
      }

      clearTimeout(timeout);
      isResolved = true;

      if (code === 0 && stdout.trim()) {
        try {
          const videoInfo = JSON.parse(stdout.trim());

          // Extract relevant information
          const info = {
            title: videoInfo.title || 'Unknown Title',
            duration: videoInfo.duration || 0, // Duration in seconds
            durationString: videoInfo.duration_string || '0:00',
            uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
            thumbnail: videoInfo.thumbnail,
            description: videoInfo.description,
            viewCount: videoInfo.view_count,
            uploadDate: videoInfo.upload_date,
            platform: detectPlatform(url)
          };

          res.json(info);
        } catch (parseError) {
          console.error('Error parsing video info JSON:', parseError);
          res.status(500).json({ error: 'Failed to parse video information' });
        }
      } else {
        console.error('yt-dlp stderr:', stderr);

        // DETECT AUTH FAILURES (Geo-lock or Bot detection)
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        const errLower = stderr.toLowerCase();
        const isAuthError = isYouTube && (
          errLower.includes('sign in to confirm') ||
          errLower.includes('please sign in') ||
          errLower.includes('bot') ||
          errLower.includes('429') ||
          errLower.includes('login_required')
        );

        // FALLBACK: Retry WITHOUT COOKIES (Public Access)
        if (isAuthError) {
          console.log('⚠️ Authentication/Sign-in error detected during analysis. Retrying without cookies (Public Access)...');

          // Filter out cookie-related args and blocked extractor args
          let fallbackArgs = ytDlpArgs.filter(arg =>
            !String(arg).includes('cookies') &&
            arg !== '--cookies' &&
            arg !== '--cookies-from-browser' &&
            arg !== '--write-info-json'
          );

          // Remove any previous extractor-args to start fresh
          const eaIndex = fallbackArgs.indexOf('--extractor-args');
          if (eaIndex > -1) {
            fallbackArgs.splice(eaIndex, 2);
          }

          // Add public-friendly args
          fallbackArgs.push(
            '--extractor-args', 'youtube:player_client=web_creator,web',
            '--ignore-no-formats-error',
            '--no-cookies',
            '--dump-json' // Ensure we get JSON output
          );

          // Ensure URL is explicitly added again if missing
          if (!fallbackArgs.includes(url)) fallbackArgs.push(url);

          const ytDlpPath = await getYtDlpPath();
          try {
            // Use execSync for synchronous fallback execution to ensure we block response until done
            // But since we are async here, spawning is better.
            // We will just execute it and wait.
            let command = ytDlpPath;
            let commandArgs = fallbackArgs;
            if (ytDlpPath.includes(' ')) {
              const parts = ytDlpPath.split(' ');
              command = parts[0];
              commandArgs = [...parts.slice(1), ...fallbackArgs];
            }

            const retryProc = spawn(command, commandArgs);
            let rOut = '';
            let rErr = '';
            retryProc.stdout.on('data', d => { rOut += d.toString(); });
            retryProc.stderr.on('data', d => { rErr += d.toString(); });

            retryProc.on('close', (rCode) => {
              if (rCode === 0 && rOut.trim()) {
                try {
                  const videoInfo = JSON.parse(rOut.trim());
                  const info = {
                    title: videoInfo.title || 'Unknown Title',
                    duration: videoInfo.duration || 0,
                    durationString: videoInfo.duration_string || '0:00',
                    uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
                    thumbnail: videoInfo.thumbnail,
                    description: videoInfo.description,
                    viewCount: videoInfo.view_count,
                    uploadDate: videoInfo.upload_date,
                    platform: detectPlatform(url)
                  };
                  res.json(info);
                } catch (e) {
                  console.error('Fallback JSON parse failed:', e);
                  res.status(500).json({ error: 'Failed to parse video info from fallback' });
                }
              } else {
                console.error('Fallback failed stderr:', rErr);
                res.status(500).json({
                  error: 'Failed to get video information',
                  details: stderr + '\n' + rErr
                });
              }
            });
            return; // Exit here if we started the retry
          } catch (retryEx) {
            console.error('Fallback execution error:', retryEx);
          }
        }

        // Existing fallback for format unavailability
        const formatUnavailable = stderr.includes('Requested format is not available') || stderr.includes('Only images are available');
        if (isYouTube && formatUnavailable) {
          console.log('🧪 Retrying with robust Web Creator client due to unavailable formats');
          // Rebuild args: try web_creator which sometimes sees more formats
          const baseArgs = ytDlpArgs.filter(a => a !== '--extractor-args' && !String(a).includes('youtube:player_client'));
          baseArgs.push('--extractor-args', 'youtube:player_client=web_creator,web');
          baseArgs.push('--ignore-no-formats-error');

          // Ensure URL is appended
          if (!baseArgs.includes(url)) baseArgs.push(url);

          const ytDlpPath = await getYtDlpPath();
          let command, commandArgs;
          if (ytDlpPath.includes(' ')) {
            const parts = ytDlpPath.split(' ');
            command = parts[0];
            commandArgs = [...parts.slice(1), ...baseArgs];
          } else {
            command = ytDlpPath;
            commandArgs = baseArgs;
          }

          const retryProc = spawn(command, commandArgs);
          let rOut = '';
          let rErr = '';
          retryProc.stdout.on('data', d => { rOut += d.toString(); });
          retryProc.stderr.on('data', d => { rErr += d.toString(); });
          retryProc.on('close', () => {
            if (rOut.trim()) {
              try {
                const videoInfo = JSON.parse(rOut.trim());
                const info = {
                  title: videoInfo.title || 'Unknown Title',
                  duration: videoInfo.duration || 0,
                  durationString: videoInfo.duration_string || '0:00',
                  uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
                  thumbnail: videoInfo.thumbnail,
                  description: videoInfo.description,
                  viewCount: videoInfo.view_count,
                  uploadDate: videoInfo.upload_date,
                  platform: detectPlatform(url)
                };
                return res.json(info);
              } catch (parseError) {
                console.error('Error parsing video info JSON (android retry):', parseError);
              }
            }

            // If retry did not yield formats, return a specific 422 message
            console.warn('No downloadable formats after Android client retry');
            return res.status(422).json({
              error: 'No downloadable formats available',
              details: 'Only storyboard images were accessible or formats are restricted. Try again later or with different network/client.'
            });
          });
          return; // Prevent falling through to the proxy rotation system
        }

        // Helper to run a strategy with web-focused clients (bypassing TV/Android loops)
        if ((url.includes('youtube.com') || url.includes('youtu.be')) &&
          (stderr.includes('Sign in to confirm') ||
            stderr.includes('please sign in') ||
            stderr.includes('bot') || stderr.includes('429') || stderr.includes('403'))) {

          console.log('🚨 YouTube access issue detected (Geo-lock). Retrying with Public Access (NO COOKIES)...');

          const retryWebArgs = [
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            // Use default client strategy but ensure we have a good User Agent
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
          ];

          // CRITICAL: PROCEED WITHOUT COOKIES (Public Access Fallback)
          // We intentionally do NOT add cookies here to bypass Geo-lock/Authentication blocks.

          // Also explicitly remove extractor args to let yt-dlp choose best public client
          // (or use base args if we were inheriting, but here we build fresh)

          retryWebArgs.push(url);

          const ytDlpPath = await getYtDlpPath();
          let command, commandArgs;
          if (ytDlpPath.includes(' ')) {
            const parts = ytDlpPath.split(' ');
            command = parts[0];
            commandArgs = [...parts.slice(1), ...retryWebArgs];
          } else {
            command = ytDlpPath;
            commandArgs = retryWebArgs;
          }

          const webRetry = spawn(command, commandArgs);
          let wOut = '', wErr = '';
          webRetry.stdout.on('data', d => wOut += d.toString());
          webRetry.stderr.on('data', d => wErr += d.toString());

          webRetry.on('close', () => {
            if (wOut.trim()) {
              try {
                return res.json(JSON.parse(wOut.trim()));
              } catch (e) { console.error('Web retry parse error', e); }
            }
            // If web retry fails, return original error
            return res.status(422).json({ error: 'YouTube Blocked', details: 'Please ensure cookies are fresh.' });
          });
          return;
        }



        // Log YouTube bot detection errors for debugging
        if (stderr.includes('Sign in to confirm') && (url.includes('youtube.com') || url.includes('youtu.be'))) {
          console.error('YouTube bot detection still occurring despite bypass measures:', stderr);
        }

        res.status(500).json({
          error: 'Failed to get video information',
          details: stderr || 'Unknown error'
        });
      }
    });

    ytDlp.on('error', (error) => {
      if (isResolved) {
        return; // Already handled by timeout
      }

      clearTimeout(timeout);
      isResolved = true;

      console.error('yt-dlp process error:', error);
      res.status(500).json({
        error: 'Failed to start yt-dlp process',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Video info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Probe audio channels in uploaded video
app.post('/api/probe-audio', upload.single('video'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-probe-'));

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const inputPath = req.file.path;
    console.log(`[PROBE-AUDIO] Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`[PROBE-AUDIO] File size: ${req.file.size} bytes`);
    console.log(`[PROBE-AUDIO] Temp path: ${inputPath}`);

    // Use ffprobe to get audio stream information
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'a',
      inputPath
    ];

    const ffprobeProcess = spawn('ffprobe', ffprobeArgs);

    let probeOutput = '';
    let errorOutput = '';

    ffprobeProcess.stdout.on('data', (data) => {
      probeOutput += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve, reject) => {
      ffprobeProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('FFprobe stderr:', errorOutput);
          reject(new Error(`FFprobe failed with code ${code}: ${errorOutput}`));
        }
      });
    });

    if (!probeOutput.trim()) {
      console.error('FFprobe returned empty output for file:', req.file.originalname);
      return res.json({ channels: [], hasAudio: false, error: 'No probe data returned' });
    }

    let probeData;
    try {
      probeData = JSON.parse(probeOutput);
    } catch (parseError) {
      console.error('Failed to parse FFprobe output:', parseError.message);
      console.error('Raw output:', probeOutput);
      return res.status(500).json({
        error: 'Failed to parse audio probe data',
        details: parseError.message
      });
    }

    const audioStreams = probeData.streams || [];
    console.log(`[PROBE-AUDIO] Found ${audioStreams.length} audio streams`);

    if (audioStreams.length === 0) {
      console.log(`[PROBE-AUDIO] No audio streams found - video-only file`);
      return res.json({
        channels: [],
        hasAudio: false,
        message: 'This video file contains no audio streams. Video conversion will proceed without audio processing.'
      });
    }

    // Handle MXF files with multiple mono streams by aggregating all channels
    const channels = [];
    let totalChannels = 0;

    audioStreams.forEach((stream, streamIndex) => {
      const streamChannels = stream.channels || 0;
      const streamLayout = stream.channel_layout || 'unknown';

      console.log(`[PROBE-AUDIO] Stream ${streamIndex}: ${streamChannels} channels, Layout: ${streamLayout}`);

      for (let i = 0; i < streamChannels; i++) {
        channels.push({
          index: totalChannels,
          label: `Stream ${streamIndex + 1} Ch ${i + 1}`,
          description: `Stream ${streamIndex + 1} - ${getChannelDescription(i, streamLayout)}`
        });
        totalChannels++;
      }
    });

    console.log(`[PROBE-AUDIO] Total channels across all streams: ${totalChannels}`);

    // Use first stream info for codec details
    const firstAudioStream = audioStreams[0];
    const channelLayout = audioStreams.length > 1 ? 'multi-stream' : (firstAudioStream.channel_layout || 'unknown');

    const response = {
      channels,
      hasAudio: true,
      channelCount: totalChannels,
      channelLayout,
      streamCount: audioStreams.length,
      streamInfo: {
        codec: firstAudioStream.codec_name,
        sampleRate: firstAudioStream.sample_rate,
        bitRate: firstAudioStream.bit_rate
      }
    };
    console.log(`[PROBE-AUDIO] Sending response:`, JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('Audio probe error:', error);
    res.status(500).json({
      error: 'Failed to probe audio channels',
      details: error.message
    });
  } finally {
    // Clean up temp files
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

// Helper function to get channel description based on layout
function getChannelDescription(index, layout) {
  const commonLayouts = {
    'mono': ['Center'],
    'stereo': ['Left', 'Right'],
    '2.1': ['Left', 'Right', 'LFE'],
    '3.0': ['Left', 'Right', 'Center'],
    '4.0': ['Front Left', 'Front Right', 'Back Left', 'Back Right'],
    '5.0': ['Front Left', 'Front Right', 'Center', 'Back Left', 'Back Right'],
    '5.1': ['Front Left', 'Front Right', 'Center', 'LFE', 'Back Left', 'Back Right'],
    '7.1': ['Front Left', 'Front Right', 'Center', 'LFE', 'Back Left', 'Back Right', 'Side Left', 'Side Right']
  };

  const layoutKey = layout.toLowerCase();
  if (commonLayouts[layoutKey] && commonLayouts[layoutKey][index]) {
    return commonLayouts[layoutKey][index];
  }

  return `Channel ${index + 1}`;
}

// Video conversion endpoint
app.post('/api/convert-video', upload.single('video'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-convert-'));

  try {
    const { format = 'mp4', quality = 'medium', leftChannel, rightChannel, resolution, sessionId } = req.body;

    console.log('🎬 SERVER DEBUG: Conversion request received with sessionId:', sessionId);
    console.log('🎬 SERVER DEBUG: Request body keys:', Object.keys(req.body));

    // Validate that a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided. Please upload a video file.' });
    }

    // Input validation
    const validFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'mp3', 'wav'];
    const validQualities = ['low', 'medium', 'high', 'maximum'];
    const validResolutions = ['original', '1920x1080', '1280x720', '854x480'];

    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        details: `Supported formats: ${validFormats.join(', ')}`
      });
    }

    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Invalid quality',
        details: `Supported qualities: ${validQualities.join(', ')}`
      });
    }

    if (resolution && !validResolutions.includes(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        details: `Supported resolutions: ${validResolutions.join(', ')}`
      });
    }

    // Validate channel parameters if provided
    if ((leftChannel !== undefined || rightChannel !== undefined) &&
      (leftChannel === undefined || rightChannel === undefined)) {
      return res.status(400).json({
        error: 'Invalid channel mapping',
        details: 'Both leftChannel and rightChannel must be provided together'
      });
    }

    // Parse channel parameters
    let leftCh, rightCh;
    if (leftChannel !== undefined && rightChannel !== undefined) {
      leftCh = parseInt(leftChannel);
      rightCh = parseInt(rightChannel);

      if (isNaN(leftCh) || isNaN(rightCh) || leftCh < 0 || rightCh < 0) {
        return res.status(400).json({
          error: 'Invalid channel indices',
          details: 'Channel indices must be non-negative integers'
        });
      }
    }

    // Set up input file path and filename
    const inputPath = req.file.path;
    const originalFilename = path.parse(req.file.originalname).name;

    console.log(`[CONVERT] Starting conversion - Format: ${format}, Quality: ${quality}, Channels: ${leftChannel}-${rightChannel}`);
    console.log(`[CONVERT] Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`[CONVERT] File size: ${req.file.size} bytes`);
    console.log(`[CONVERT] Temp path: ${inputPath}`);

    // Set up output path
    const outputFilename = `${originalFilename}_converted.${format}`;
    const outputPath = path.join(tempDir, outputFilename);

    // Configure ffmpeg arguments based on format and quality
    let ffmpegArgs = ['-i', inputPath];

    // Handle audio channel mapping if specified
    if (leftChannel !== undefined && rightChannel !== undefined) {
      try {
        // Validate channel parameters
        const leftCh = parseInt(leftChannel);
        const rightCh = parseInt(rightChannel);

        if (isNaN(leftCh) || isNaN(rightCh) || leftCh < 0 || rightCh < 0) {
          throw new Error(`Invalid channel parameters: left=${leftChannel}, right=${rightChannel}`);
        }

        console.log(`Debug: Mapping audio channels - Left: ${leftCh}, Right: ${rightCh}`);

        // First, probe the input to determine the number of audio streams
        const probeArgs = ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'a', inputPath];
        const probeProcess = spawn('ffprobe', probeArgs);

        let probeOutput = '';
        let probeError = '';

        probeProcess.stdout.on('data', (data) => {
          probeOutput += data.toString();
        });

        probeProcess.stderr.on('data', (data) => {
          probeError += data.toString();
        });

        await new Promise((resolve, reject) => {
          probeProcess.on('close', (code) => {
            if (code === 0 && probeOutput.trim()) {
              resolve();
            } else {
              reject(new Error(`Failed to probe audio streams: ${probeError || 'No output'}`));
            }
          });
        });

        let probeData;
        try {
          probeData = JSON.parse(probeOutput);
        } catch (parseError) {
          throw new Error(`Failed to parse probe output: ${parseError.message}`);
        }

        const audioStreams = probeData.streams || [];
        const streamCount = audioStreams.length;

        if (streamCount === 0) {
          console.log('No audio streams found - will process as video-only file');
          // For video-only files, skip audio channel mapping and continue with conversion
        } else {

          console.log(`Debug: Found ${streamCount} audio streams`);

          // Validate channel indices against available channels
          let totalChannels = 0;
          audioStreams.forEach(stream => {
            totalChannels += stream.channels || 1;
          });

          if (leftCh >= totalChannels || rightCh >= totalChannels) {
            throw new Error(`Channel index out of range. Available channels: 0-${totalChannels - 1}, requested: ${leftCh}, ${rightCh}`);
          }

          if (streamCount > 1) {
            // For multiple mono streams (like MXF), merge them first then map channels
            ffmpegArgs.push(
              '-filter_complex',
              `amerge=inputs=${streamCount}[merged];[merged]channelmap=map=${leftCh}|${rightCh}:channel_layout=stereo[aout]`,
              '-map', '0:v:0',
              '-map', '[aout]',
              '-avoid_negative_ts', 'make_zero'
            );
          } else {
            // For single stream with multiple channels
            const audioStream = audioStreams[0];
            const channels = audioStream.channels || 1;

            if (channels === 2 && leftCh === 0 && rightCh === 1) {
              // If it's already stereo and we want L=0, R=1, just copy the audio
              ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0');
            } else if (channels >= 2) {
              // For stereo/multi-channel, use channel mapping
              ffmpegArgs.push(
                '-filter_complex',
                `[0:a]channelmap=map=${leftCh}|${rightCh}:channel_layout=stereo[aout]`,
                '-map', '0:v:0',
                '-map', '[aout]',
                '-avoid_negative_ts', 'make_zero'
              );
            } else {
              // For mono, duplicate the channel
              ffmpegArgs.push(
                '-filter_complex',
                `[0:a]channelmap=map=0|0:channel_layout=stereo[aout]`,
                '-map', '0:v:0',
                '-map', '[aout]',
                '-avoid_negative_ts', 'make_zero'
              );
            }
          }
        } // Close the else block from the streamCount check
      } catch (channelError) {
        console.error('Audio channel mapping error:', channelError.message);
        throw new Error(`Audio channel mapping failed: ${channelError.message}`);
      }
    }

    // Check if we should use stream copy for same format conversion
    // Disable stream copy if resolution scaling is requested
    const useStreamCopy = req.file.originalname.toLowerCase().endsWith('.mp4') && format === 'mp4' && quality === 'medium' && (leftChannel === undefined && rightChannel === undefined) && (!resolution || resolution === 'original');

    if (leftChannel === undefined && rightChannel === undefined && !useStreamCopy) {
      // For basic conversion without channel mapping, explicitly map only main streams
      // This excludes attached pictures and other metadata streams
      // Check if input has audio streams first
      try {
        const probeResult = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_streams',
          '-select_streams', 'a',
          inputPath
        ]);

        let probeOutput = '';
        probeResult.stdout.on('data', (data) => {
          probeOutput += data.toString();
        });

        await new Promise((resolve, reject) => {
          probeResult.on('close', (code) => {
            if (code === 0) {
              try {
                const probeData = JSON.parse(probeOutput);
                const hasAudio = probeData.streams && probeData.streams.length > 0;

                if (hasAudio) {
                  ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
                } else {
                  console.log('No audio streams detected - processing as video-only');
                  ffmpegArgs.push('-map', '0:v:0', '-an'); // -an excludes audio
                }
                resolve();
              } catch (parseError) {
                // Fallback to original mapping if probe fails
                ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
                resolve();
              }
            } else {
              // Fallback to original mapping if probe fails
              ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
              resolve();
            }
          });
        });
      } catch (error) {
        // Fallback to original mapping if probe fails
        ffmpegArgs.push('-map', '0:v:0', '-map', '0:a:0?');
      }
    }

    // Resolution scaling (skip for stream copy and audio-only formats)
    if (!useStreamCopy && resolution && resolution !== 'original' && !['mp3', 'wav'].includes(format)) {
      // Parse resolution string (e.g., "1280x720" -> width=1280, height=720)
      const [width, height] = resolution.split('x').map(Number);
      // Add scaling filter with proper width and height values
      ffmpegArgs.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
    }

    // Quality settings (skip for stream copy)
    if (!useStreamCopy) {
      switch (quality) {
        case 'low':
          ffmpegArgs.push('-crf', '28', '-preset', 'fast');
          break;
        case 'high':
          ffmpegArgs.push('-crf', '18', '-preset', 'slow');
          break;
        case 'maximum':
          ffmpegArgs.push('-crf', '15', '-preset', 'veryslow');
          break;
        default: // medium
          ffmpegArgs.push('-crf', '23', '-preset', 'medium');
      }
    }

    // Format-specific settings
    switch (format) {
      case 'webm':
        ffmpegArgs.push('-c:v:0', 'libvpx-vp9', '-c:a:0', 'libopus');
        break;
      case 'avi':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p');
        break;
      case 'mov':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-movflags', '+faststart');
        break;
      case 'mkv':
        ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p');
        break;
      case 'mp3':
        // Check if input has audio before attempting audio-only conversion
        try {
          const probeResult = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'a',
            inputPath
          ]);

          let probeOutput = '';
          probeResult.stdout.on('data', (data) => {
            probeOutput += data.toString();
          });

          await new Promise((resolve, reject) => {
            probeResult.on('close', (code) => {
              if (code === 0) {
                try {
                  const probeData = JSON.parse(probeOutput);
                  const hasAudio = probeData.streams && probeData.streams.length > 0;

                  if (hasAudio) {
                    ffmpegArgs.push('-vn', '-c:a', 'libmp3lame', '-b:a', '192k');
                  } else {
                    throw new Error('Cannot convert video-only file to MP3 format - no audio streams available');
                  }
                  resolve();
                } catch (parseError) {
                  reject(new Error('Cannot convert to MP3 - audio stream detection failed'));
                }
              } else {
                reject(new Error('Cannot convert to MP3 - audio stream detection failed'));
              }
            });
          });
        } catch (error) {
          throw error;
        }
        break;
      case 'wav':
        // Check if input has audio before attempting audio-only conversion
        try {
          const probeResult = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'a',
            inputPath
          ]);

          let probeOutput = '';
          probeResult.stdout.on('data', (data) => {
            probeOutput += data.toString();
          });

          await new Promise((resolve, reject) => {
            probeResult.on('close', (code) => {
              if (code === 0) {
                try {
                  const probeData = JSON.parse(probeOutput);
                  const hasAudio = probeData.streams && probeData.streams.length > 0;

                  if (hasAudio) {
                    ffmpegArgs.push('-vn', '-c:a', 'pcm_s16le');
                  } else {
                    throw new Error('Cannot convert video-only file to WAV format - no audio streams available');
                  }
                  resolve();
                } catch (parseError) {
                  reject(new Error('Cannot convert to WAV - audio stream detection failed'));
                }
              } else {
                reject(new Error('Cannot convert to WAV - audio stream detection failed'));
              }
            });
          });
        } catch (error) {
          throw error;
        }
        break;
      default: // mp4
        if (useStreamCopy) {
          // Use stream copy for same format with default quality to avoid codec conflicts
          // Don't use complex mapping with stream copy
          ffmpegArgs.push('-c:v', 'copy', '-c:a', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart');
        } else {
          // Re-encode with compatible settings for quality changes or different input formats
          ffmpegArgs.push('-c:v:0', 'libx264', '-c:a:0', 'aac', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-movflags', '+faststart');
        }
    }

    // Add progress tracking arguments
    ffmpegArgs.push('-progress', 'pipe:2', '-y', outputPath);

    // Run ffmpeg conversion
    console.log(`Debug: Running FFmpeg with args: ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let conversionOutput = '';
    let conversionError = '';
    let videoDuration = null;

    ffmpegProcess.stdout.on('data', (data) => {
      conversionOutput += data.toString();
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      conversionOutput += output;
      conversionError += output;

      // Parse FFmpeg progress for conversion tracking
      if (sessionId) {
        const lines = output.split('\n');
        for (const line of lines) {
          // Extract video duration from initial output
          if (!videoDuration) {
            const durationMatch = line.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (durationMatch) {
              const hours = parseInt(durationMatch[1]);
              const minutes = parseInt(durationMatch[2]);
              const seconds = parseFloat(durationMatch[3]);
              videoDuration = hours * 3600 + minutes * 60 + seconds;
            }
          }

          // Parse progress from time= output
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch && videoDuration) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(100, (currentTime / videoDuration) * 100);

            // Extract additional details
            const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/);
            const speedMatch = line.match(/speed=\s*([\d.]+)x/);
            const bitrateMatch = line.match(/bitrate=\s*([\d.]+\w+\/s)/);

            sendProgressUpdate(sessionId, 'conversion', progress, {
              currentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds)).padStart(2, '0')}`,
              totalTime: `${String(Math.floor(videoDuration / 3600)).padStart(2, '0')}:${String(Math.floor((videoDuration % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(videoDuration % 60)).padStart(2, '0')}`,
              fps: fpsMatch ? parseFloat(fpsMatch[1]) : null,
              speed: speedMatch ? speedMatch[1] + 'x' : null,
              bitrate: bitrateMatch ? bitrateMatch[1] : null
            });
          }
        }
      }
    });

    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg conversion completed successfully');
          resolve();
        } else {
          console.error(`FFmpeg failed with exit code ${code}`);
          console.error('FFmpeg error output:', conversionError);
          console.error('FFmpeg full output:', conversionOutput);

          // Extract meaningful error message
          let errorMessage = 'Unknown FFmpeg error';
          if (conversionError.includes('Invalid argument')) {
            errorMessage = 'Invalid FFmpeg arguments or unsupported format';
          } else if (conversionError.includes('No such file')) {
            errorMessage = 'Input file not found or inaccessible';
          } else if (conversionError.includes('Permission denied')) {
            errorMessage = 'Permission denied accessing file';
          } else if (conversionError.includes('amerge')) {
            errorMessage = 'Audio merging failed - check channel configuration';
          } else if (conversionError.includes('channelmap')) {
            errorMessage = 'Audio channel mapping failed - invalid channel indices';
          } else if (conversionError.includes('does not contain any stream')) {
            errorMessage = 'Input file contains no valid streams';
          } else if (conversionError.includes('Invalid data found')) {
            errorMessage = 'Input file is corrupted or invalid format';
          } else if (conversionError.includes('Protocol not found')) {
            errorMessage = 'Network protocol error - unable to access input';
          } else if (conversionError.includes('Connection refused')) {
            errorMessage = 'Network connection failed';
          } else if (conversionError.includes('HTTP error')) {
            errorMessage = 'HTTP error accessing input file';
          } else if (code === 183) {
            errorMessage = `FFmpeg exit code 183 - detailed error: ${conversionError.slice(-200)}`;
          }

          reject(new Error(`FFmpeg conversion failed (code ${code}): ${errorMessage}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        reject(new Error(`Failed to start FFmpeg: ${error.message}`));
      });
    });

    // Check if output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Conversion completed but output file not found');
    }

    // Send the converted file
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

  } catch (error) {
    console.error('Video conversion error:', error);

    // Clean up temp directory on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    res.status(500).json({
      error: 'Video conversion failed',
      details: error.message
    });
  }
});

// Serve static files from the dist directory (only if not backend-only mode)
if (process.env.BACKEND_ONLY !== 'true') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Serve frontend for all other GET routes (not API routes)
app.get('*', (req, res) => {
  // Only serve frontend for HTML routes when not in backend-only mode
  if (process.env.BACKEND_ONLY !== 'true' &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/assets/') &&
    !req.path.includes('.') &&
    req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    // For all other requests (static files, etc.), let them 404 naturally
    res.status(404).send('File not found');
  }
});



// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.BACKEND_ONLY === 'true') {
    console.log(`Backend-only mode: API available at: http://localhost:${PORT}/api`);
  } else {
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
  }
  console.log(`WebSocket server available at: ws://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
