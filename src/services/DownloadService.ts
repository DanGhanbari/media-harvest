import { saveAs } from 'file-saver';
import { MediaItem } from './MediaDetectionService';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

export interface QualityOption {
  value: string;
  label: string;
  description: string;
}

interface ProgressDetails {
  size?: string;
  speed?: string;
  eta?: string;
  currentTime?: string;
  totalTime?: string;
  fps?: number;
  bitrate?: string;
}

interface DownloadRequest {
  url: string;
  filename: string;
  quality: string;
  sessionId?: string;
  startTime?: string | number;
  endTime?: string | number;
}

export class DownloadService {
  private static activeDownloads = new Map<string, AbortController>();
  private static ws: WebSocket | null = null;
  private static progressCallbacks = new Map<string, (progress: number, details?: ProgressDetails) => void>();
  private static sessionId: string = '';

  // Test WebSocket connection
  static testWebSocketConnection(): void {
    console.log('🧪 TESTING: WebSocket connection test started');
    console.log('🧪 TESTING: API_BASE_URL:', API_BASE_URL);
    console.log('🧪 TESTING: SessionId:', this.sessionId);
    this.initWebSocket();
  }

  // Expose test function globally for debugging
  static exposeTestFunction(): void {
    (window as unknown as { testWebSocket: () => void }).testWebSocket = () => this.testWebSocketConnection();
    console.log('🧪 TESTING: WebSocket test function exposed. Run testWebSocket() in console to test.');
  }

  static initWebSocket(useSecure: boolean = true): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('🔌 DownloadService: WebSocket already connected, sessionId:', this.sessionId);
      return;
    }

    // Always regenerate sessionId to ensure sync between client and server
    // This prevents callback mismatches when WebSocket reconnects
    const oldSessionId = this.sessionId;
    this.sessionId = Math.random().toString(36).substring(2, 15);
    console.log('🔌 DownloadService: Generated new sessionId:', this.sessionId, 'Previous:', oldSessionId);

    // Check if we're on Vercel (serverless platform that doesn't support WebSockets)
    const isVercel = window.location.hostname.includes('vercel.app') || 
                     window.location.hostname.includes('vercel.com');
    
    if (isVercel) {
      console.log('🔌 CLIENT DEBUG: Vercel environment detected - WebSocket connections not supported on serverless platforms');
      console.log('🔌 CLIENT DEBUG: Downloads will work without real-time progress updates');
      return;
    }

    // Use the same base URL as the API but convert to WebSocket protocol
    // Handle both absolute URLs and relative URLs (for Vercel proxy)
    let wsUrl: string;
    if (API_BASE_URL === '' || API_BASE_URL.startsWith('/')) {
      // For relative URLs (Vercel proxy), use current window location
      const protocol = window.location.protocol === 'https:' && useSecure ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    } else {
      // For absolute URLs, extract host from API_BASE_URL
      const apiUrl = new URL(API_BASE_URL);
      const protocol = (apiUrl.protocol === 'https:' && useSecure) ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${apiUrl.host}`;
    }
    
    console.log(`🔌 CLIENT DEBUG: API_BASE_URL: ${API_BASE_URL}`);
    console.log(`🔌 CLIENT DEBUG: Final WebSocket URL: ${wsUrl}`);
    console.log(`🔌 DownloadService: Attempting WebSocket connection to: ${wsUrl} with sessionId: ${this.sessionId}`);
    console.log('🔌 DownloadService: Creating WebSocket connection to:', wsUrl);
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('🔌 DownloadService: WebSocket connected for progress tracking, sessionId:', this.sessionId);
      console.log('🔌 DownloadService: WebSocket readyState:', this.ws?.readyState);
      // Register session with server
      const registerMessage = {
        type: 'register',
        sessionId: this.sessionId
      };
      console.log('🔌 DownloadService: Sending registration message:', registerMessage);
      this.ws?.send(JSON.stringify(registerMessage));
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 DownloadService: WebSocket message received', data);
        console.log('📨 DownloadService: Current progress callbacks:', Array.from(this.progressCallbacks.keys()));
        
        if (data.type === 'progress') {
          console.log('📊 DownloadService: Checking for callback with operation:', JSON.stringify(data.operation));
          console.log('📊 DownloadService: Available callback keys:', Array.from(this.progressCallbacks.keys()).map(k => JSON.stringify(k)));
          console.log('📊 DownloadService: Frontend sessionId:', this.sessionId);
          console.log('📊 DownloadService: Message data:', data);
          
          const callback = this.progressCallbacks.get(data.operation);
          if (callback) {
            const timestamp = new Date().toISOString();
            console.log(`🔄 DownloadService: Progress callback invoked at ${timestamp} with progress:`, data.progress, 'for operation:', data.operation);
            console.log('🔄 DownloadService: Progress data:', data);
            callback(data.progress, data);
          } else {
            console.log('❌ DownloadService: No callback found for operation:', JSON.stringify(data.operation));
            console.log('❌ DownloadService: Available callbacks:', Array.from(this.progressCallbacks.keys()).map(k => JSON.stringify(k)));
            console.log('❌ DownloadService: Operation length:', data.operation?.length, 'First callback key length:', Array.from(this.progressCallbacks.keys())[0]?.length);
            console.log('❌ DownloadService: Operation char codes:', Array.from(data.operation || '').map(c => (typeof c === 'string' ? c.charCodeAt(0) : 0)));
            console.log('❌ DownloadService: First callback char codes:', Array.from(Array.from(this.progressCallbacks.keys())[0] || '').map(c => (typeof c === 'string' ? c.charCodeAt(0) : 0)));
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      const timestamp = new Date().toISOString();
      console.log(`🔌 DownloadService: WebSocket disconnected at ${timestamp}`);
      console.log('🔌 DownloadService: Active downloads at disconnect:', Array.from(this.activeDownloads.keys()));
      console.log('🔌 DownloadService: Progress callbacks at disconnect:', Array.from(this.progressCallbacks.keys()));
      this.ws = null;
      // Only attempt to reconnect if there are active downloads
      if (this.activeDownloads.size > 0) {
        console.log('🔌 DownloadService: Active downloads detected, attempting to reconnect in 3 seconds');
        console.log('🔌 DownloadService: Clearing', this.progressCallbacks.size, 'old progress callbacks (new sessionId will be generated)');
        // Clear old callbacks since they won't work with the new sessionId
        this.progressCallbacks.clear();
        setTimeout(() => {
          console.log(`🔌 DownloadService: Reconnecting WebSocket at ${new Date().toISOString()}`);
          this.initWebSocket();
        }, 3000);
      } else {
        console.log('🔌 DownloadService: No active downloads, not reconnecting');
        // Clear callbacks when not reconnecting
        this.progressCallbacks.clear();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('🔌 DownloadService: WebSocket error:', error);
      console.error('🔌 DownloadService: WebSocket error event:', error.type);
      console.error('🔌 DownloadService: WebSocket readyState on error:', this.ws?.readyState);
      console.error('🔌 DownloadService: WebSocket URL on error:', wsUrl);
      // If wss:// fails in production, try fallback to ws://
      if (window.location.protocol === 'https:' && useSecure) {
        console.log('🔌 DownloadService: WSS connection failed, attempting fallback to WS...');
        setTimeout(() => {
          this.initWebSocket(false); // Retry with non-secure connection
        }, 1000);
      }
    };
  }

  static async downloadMedia(item: MediaItem, quality?: string, onProgress?: (progress: number) => void, startTime?: string | number, endTime?: string | number): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`📥 DownloadService: downloadMedia called at ${timestamp}`, { filename: item.filename, quality, hasProgressCallback: !!onProgress, sessionId: this.sessionId, url: item.url });
    console.log('📥 DownloadService: Current active downloads:', Array.from(this.activeDownloads.keys()));
    console.log('📥 DownloadService: Current progress callbacks:', Array.from(this.progressCallbacks.keys()));
    
    const downloadId = item.url;
    
    // Initialize WebSocket if not already connected
    this.initWebSocket();
    
    // Wait for WebSocket to connect if it's not already connected
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.log('📥 DownloadService: Waiting for WebSocket connection...');
      await new Promise(resolve => {
        const startTime = Date.now();
        const checkConnection = () => {
          console.log('📥 DownloadService: Checking WebSocket state:', this.ws?.readyState, 'Expected OPEN:', WebSocket.OPEN);
          if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('📥 DownloadService: WebSocket connection established');
            resolve(true);
          } else if (Date.now() - startTime > 5000) {
            console.log('📥 DownloadService: WebSocket connection timeout, proceeding without real-time progress');
            console.log('📥 DownloadService: Final WebSocket state:', this.ws?.readyState);
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }
    
    // Register progress callback for this download using unique key
    const callbackKey = `download_${item.url}`;
    if (onProgress) {
      console.log('📊 DownloadService: Progress callback registered for operation:', JSON.stringify(callbackKey), 'sessionId:', this.sessionId);
      console.log('📊 DownloadService: Item URL for callback key:', JSON.stringify(item.url));
      this.progressCallbacks.set(callbackKey, onProgress);
      console.log('📊 DownloadService: Current callbacks after registration:', Array.from(this.progressCallbacks.keys()).map(k => JSON.stringify(k)));
    }
    
    // Create abort controller for this download
    const abortController = new AbortController();
    this.activeDownloads.set(downloadId, abortController);

    try {
      // Handle different types of media downloads
    if (item.type === 'video' && item.url.includes('blob:')) {
      await this.downloadBlobVideo(item);
    } else if (this.isSupportedPlatform(item.url)) {
      await this.downloadEmbeddedVideo(item, quality, abortController.signal, onProgress, startTime, endTime);
    } else {
      await this.downloadDirectMedia(item, abortController.signal);
    }
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Failed to download ${item.filename}`);
    } finally {
      this.activeDownloads.delete(downloadId);
      // Clean up the progress callback using the same unique key
      const callbackKey = `download_${item.url}`;
      this.progressCallbacks.delete(callbackKey);
      console.log('🧹 DownloadService: Cleaned up callback for:', callbackKey);
    }
  }

  static async cancelDownload(itemUrl: string): Promise<void> {
    const abortController = this.activeDownloads.get(itemUrl);
    if (abortController) {
      // First abort the fetch request
      abortController.abort();
      this.activeDownloads.delete(itemUrl);
      
      // Then call the backend cancel endpoint
      try {
        await fetch(API_ENDPOINTS.CANCEL_DOWNLOAD, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: itemUrl }),
        });
        // Download cancellation request sent to backend
      } catch (error) {
        console.error('Failed to send cancellation request to backend:', error);
      }
    }
  }

  static isDownloadActive(itemUrl: string): boolean {
    return this.activeDownloads.has(itemUrl);
  }

  static async getQualityOptions(): Promise<QualityOption[]> {
    try {
      const response = await fetch(API_ENDPOINTS.QUALITY_OPTIONS);
      if (!response.ok) {
        throw new Error('Failed to fetch quality options');
      }
      const data = await response.json();
      return data.options;
    } catch (error) {
      console.error('Failed to get quality options:', error);
      // Return default options if API fails
      return [
        { value: 'maximum', label: 'Best Quality', description: 'Best available quality up to 4K' },
        { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
        { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
        { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' }
      ];
    }
  }

  static async getVideoInfo(url: string): Promise<{ title: string; duration: number; uploader: string; thumbnail?: string } | null> {
    try {
      console.log('🔍 getVideoInfo called with URL:', url);
      console.log('🔍 API_ENDPOINTS.VIDEO_INFO:', API_ENDPOINTS.VIDEO_INFO);
      
      // Add a client-side timeout as well (50 seconds to allow for server timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000);
      
      const requestBody = JSON.stringify({ url });
      console.log('🔍 Request body:', requestBody);
      
      console.log('🔍 Making fetch request...');
      const response = await fetch(API_ENDPOINTS.VIDEO_INFO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('🔍 Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        
        if (response.status === 408) {
          console.warn('Video analysis timed out - video may be too large or network too slow');
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('🔍 Raw response text:', responseText);
      
      const data = JSON.parse(responseText);
      console.log('🔍 Parsed response data:', data);
      
      const result = {
        title: data.title || 'Unknown Title',
        duration: data.duration || 0,
        uploader: data.uploader || 'Unknown',
        thumbnail: data.thumbnail
      };
      
      console.log('✅ getVideoInfo returning:', result);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Video analysis request was aborted due to timeout');
        return null;
      }
      console.error('❌ Failed to fetch video info:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  private static async downloadDirectMedia(item: MediaItem, signal?: AbortSignal): Promise<void> {
    try {
      console.log('📡 DownloadService: Downloading direct media via backend API');
      
      const response = await fetch(API_ENDPOINTS.DOWNLOAD_DIRECT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: item.url,
          filename: item.filename
        }),
        signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Backend download failed: ${errorData.error || response.statusText}`);
      }
      
      // Get the file as a blob and save it
      const blob = await response.blob();
      saveAs(blob, item.filename);
      
    } catch (error) {
      console.error('Direct media download failed:', error);
      // Last resort: create a download link
      this.createDownloadLink(item.url, item.filename);
    }
  }

  private static async downloadBlobVideo(item: MediaItem): Promise<void> {
    try {
      // For blob URLs, we need to handle them client-side since they're browser-specific
      // First try to check with backend (will return helpful error message)
      console.log('📡 DownloadService: Checking blob download with backend');
      
      const backendResponse = await fetch(API_ENDPOINTS.DOWNLOAD_BLOB, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: item.url,
          filename: item.filename
        })
      });
      
      if (!backendResponse.ok) {
        // Backend confirms blob URLs must be handled client-side
        console.log('📱 DownloadService: Handling blob URL client-side as expected');
      }
      
      // Handle blob URL directly in the browser
      const response = await fetch(item.url);
      const blob = await response.blob();
      saveAs(blob, item.filename);
      
    } catch (error) {
      console.error('Failed to download blob video:', error);
      throw error;
    }
  }

  private static async downloadEmbeddedVideo(item: MediaItem, quality?: string, signal?: AbortSignal, onProgress?: (progress: number) => void, startTime?: string | number, endTime?: string | number): Promise<void> {
    // Downloading video from supported platform
    
    // Handle all supported platforms using the unified backend
    if (this.isSupportedPlatform(item.url)) {
      try {
        await this.downloadFromPlatform(item, quality, signal, onProgress, startTime, endTime);
        return;
      } catch (error) {
        console.error('Platform download failed:', error);
        throw new Error(`Failed to download video from ${this.getPlatformName(item.url)}`);
      }
    }

    // For unsupported platforms, try direct download
    try {
      await this.downloadDirectMedia(item, signal);
    } catch (error) {
      console.error('Direct download failed:', error);
      throw new Error('Failed to download embedded video');
    }
  }
  


  private static isSupportedPlatform(url: string): boolean {
    const supportedPlatforms = [
      'youtube.com', 'youtu.be',
      'instagram.com',
      'facebook.com', 'fb.watch',
      'twitter.com', 'x.com',
      'tiktok.com',
      'vimeo.com',
      'dailymotion.com',
      'twitch.tv',
      'reddit.com',
      'streamable.com',
      'rumble.com',
      'bitchute.com',
      'odysee.com', 'lbry.tv',
      'pornhub.com',
      'xvideos.com'
    ];
    
    return supportedPlatforms.some(platform => url.toLowerCase().includes(platform));
  }

  static isYouTubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  static async checkIfLongVideo(url: string): Promise<{ isLong: boolean; duration: number; videoInfo?: { title: string; duration: number; uploader: string; thumbnail?: string } }> {
    if (!this.isYouTubeUrl(url)) {
      return { isLong: false, duration: 0 };
    }

    const videoInfo = await this.getVideoInfo(url);
    if (!videoInfo) {
      return { isLong: false, duration: 0 };
    }

    const isLong = videoInfo.duration > 960; // 16 minutes = 960 seconds
    return {
      isLong,
      duration: videoInfo.duration,
      videoInfo
    };
  }
  
  private static getPlatformName(url: string): string {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'YouTube';
    } else if (urlLower.includes('instagram.com')) {
      return 'Instagram';
    } else if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
      return 'Facebook';
    } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'Twitter/X';
    } else if (urlLower.includes('tiktok.com')) {
      return 'TikTok';
    } else if (urlLower.includes('vimeo.com')) {
      return 'Vimeo';
    } else if (urlLower.includes('dailymotion.com')) {
      return 'Dailymotion';
    } else if (urlLower.includes('twitch.tv')) {
      return 'Twitch';
    } else if (urlLower.includes('reddit.com')) {
      return 'Reddit';
    } else if (urlLower.includes('streamable.com')) {
      return 'Streamable';
    } else if (urlLower.includes('rumble.com')) {
      return 'Rumble';
    } else if (urlLower.includes('bitchute.com')) {
      return 'BitChute';
    } else if (urlLower.includes('odysee.com') || urlLower.includes('lbry.tv')) {
      return 'Odysee';
    } else if (urlLower.includes('pornhub.com')) {
      return 'Pornhub';
    } else if (urlLower.includes('xvideos.com')) {
      return 'XVideos';
    } else {
      return 'Unknown Platform';
    }
  }
  
  private static async downloadFromPlatform(item: MediaItem, quality: string = 'maximum', signal?: AbortSignal, onProgress?: (progress: number) => void, startTime?: string | number, endTime?: string | number): Promise<void> {
    const downloadServices = [
      // Service 1: Try local yt-dlp backend (most reliable)
      async () => {
        // Create a timeout controller for large file downloads (5 minutes)
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 300000);
        
        // Combine the existing signal with timeout signal
         let combinedSignal = timeoutController.signal;
         if (signal) {
           // If AbortSignal.any is available (newer browsers), use it
           if (typeof AbortSignal.any === 'function') {
             combinedSignal = AbortSignal.any([signal, timeoutController.signal]);
           } else {
             // Fallback: listen to the original signal and abort timeout controller
             signal.addEventListener('abort', () => timeoutController.abort());
             combinedSignal = timeoutController.signal;
           }
         }
        
        try {
          const requestBody: DownloadRequest = {
            url: item.url,
            filename: item.filename,
            quality: quality,
            sessionId: this.sessionId,
            ...(startTime !== undefined && { startTime }),
            ...(endTime !== undefined && { endTime })
          };

          console.log('📡 DownloadService: Making fetch request to', API_ENDPOINTS.DOWNLOAD_VIDEO);
          
          const response = await fetch(API_ENDPOINTS.DOWNLOAD_VIDEO, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: combinedSignal
          });
          
          console.log('✅ DownloadService: Fetch response status:', response.status);
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            
            // Handle authentication errors for Instagram/Facebook/YouTube with helpful messages
            if (response.status === 403 && errorData.platform) {
              let errorMessage = '';
              if (errorData.platform === 'youtube') {
                errorMessage = `🚫 ${errorData.error}\n\n${errorData.details}\n\n💡 ${errorData.suggestion}`;
              } else if (errorData.platform === 'instagram' || errorData.platform === 'facebook') {
                errorMessage = errorData.isProduction 
                  ? `🚫 ${errorData.error}\n\n${errorData.details}\n\n💡 ${errorData.suggestion}`
                  : `${errorData.error}\n\n${errorData.details}\n\n💡 ${errorData.suggestion}`;
              }
              throw new Error(errorMessage);
            }
            
            throw new Error(`Backend download failed: ${errorData.error || response.statusText}`);
          }
          
          // Get the file as a blob and save it
          const blob = await response.blob();
          saveAs(blob, item.filename);
          return;
        } catch (error) {
           clearTimeout(timeoutId);
           throw error;
         }
      }
      // Note: Fallback services removed as they only support YouTube
      // For multi-platform support, we rely on the yt-dlp backend
    ];

    let lastError: Error | null = null;
    
    for (let i = 0; i < downloadServices.length; i++) {
      try {
        // Trying download service
        await downloadServices[i]();
        return;
      } catch (error) {
        lastError = error as Error;
        // Service failed
      }
    }
    
    throw new Error(`All download services failed for ${this.getPlatformName(item.url)}. To use yt-dlp backend, please install yt-dlp (pip install yt-dlp) and run the server with 'npm run dev:full'. Last error: ${lastError?.message}`);
  }

  private static createDownloadLink(url: string, filename: string): void {
    try {
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to create download link:', error);
      // Fallback: open URL in new tab
      window.open(url, '_blank');
    }
  }
  
  private static extractYouTubeId(url: string): string {
    // Attempting to extract YouTube ID
    
    // Clean URL by removing fragments and the '?si=' parameter
    const cleanUrl = url.split('#')[0].split('?si=')[0];
    
    // Extract YouTube video ID from various URL formats
    const patterns = [
      // Standard URL patterns
      /youtu\.be\/([^/]+)/,
      /youtube\.com\/watch\?v=([^/&]+)/,
      /youtube\.com\/embed\/([^/]+)/,
      /youtube\.com\/v\/([^/]+)/,
      
      // Shortened URL patterns
      /youtube\.com\/shorts\/([^/]+)/,
      
      // With additional parameters
      /youtube\.com\/watch\?.*v=([^/&]+)/,
      
      // Mobile URLs
      /m\.youtube\.com\/watch\?v=([^/&]+)/,
      
      // Embedded URLs
      /youtube\.com\/embed\/([^/]+)/,
      /youtube-nocookie\.com\/embed\/([^/]+)/,
      
      // Live stream URLs
      /youtube\.com\/live\/([^/]+)/,
      
      // Channel URLs with video ID
      /youtube\.com\/c\/[^/]+\/videos\/([^/]+)/
    ];
    
    // Try each pattern until we find a match
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      // Trying pattern
      if (match && match[1] && (match[1].length === 11 || match[1].length === 10)) {
        // Found video ID
        return match[1];
      }
    }
    
    // Fallback to original pattern
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/videos\/|\/embed\/|\/v\/|\/e\/|watch\?v=|\?v=|&v=|embed\?v=|\/v\/|\/e\/|watch\?v=|\?v=|&v=)([^#&?]*).*/;
    const fallbackMatch = cleanUrl.match(regExp);
    // Fallback match
    
    const result = (fallbackMatch && fallbackMatch[2] && (fallbackMatch[2].length === 11 || fallbackMatch[2].length === 10)) ? fallbackMatch[2] : '';
    // Final result
    
    if (!result) {
      throw new Error(`Could not extract YouTube ID from URL: ${url}`);
    }
    
    return result;
  }

  static async downloadAll(items: MediaItem[]): Promise<void> {
    const downloadPromises = items.map(item => this.downloadMedia(item));
    
    try {
      await Promise.allSettled(downloadPromises);
    } catch (error) {
      console.error('Bulk download failed:', error);
      throw error;
    }
  }

  static async downloadWithFFmpeg(item: MediaItem): Promise<void> {
    // Note: FFmpeg integration would require a backend service or WebAssembly version
    // For now, we'll show instructions for manual FFmpeg usage
    
    const ffmpegInstructions = `
      To download this media with FFmpeg, use the following command:
      
      ffmpeg -i "${item.url}" -c copy "${item.filename}"
      
      For blob videos or complex streams, you might need:
      ffmpeg -i "${item.url}" -c:v libx264 -c:a aac "${item.filename}"
    `;
    
    // FFmpeg instructions available
    
    // For demo purposes, fall back to regular download
    await this.downloadDirectMedia(item);
  }
}