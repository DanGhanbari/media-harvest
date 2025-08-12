import { saveAs } from 'file-saver';
import { MediaItem } from './MediaDetectionService';
import { API_ENDPOINTS } from '../config/api';

export interface QualityOption {
  value: string;
  label: string;
  description: string;
}

export class DownloadService {
  private static activeDownloads = new Map<string, AbortController>();

  static async downloadMedia(item: MediaItem, quality?: string, onProgress?: (progress: number) => void): Promise<void> {
    const downloadId = item.url;
    
    // Create abort controller for this download
    const abortController = new AbortController();
    this.activeDownloads.set(downloadId, abortController);

    try {
      // Handle different types of media downloads
    if (item.type === 'video' && item.url.includes('blob:')) {
      await this.downloadBlobVideo(item);
    } else if (this.isSupportedPlatform(item.url)) {
      await this.downloadEmbeddedVideo(item, quality, abortController.signal, onProgress);
    } else {
      await this.downloadDirectMedia(item, abortController.signal);
    }
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Failed to download ${item.filename}`);
    } finally {
      this.activeDownloads.delete(downloadId);
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
        console.log('Download cancellation request sent to backend');
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
        { value: 'high', label: 'High Quality (1080p)', description: 'Full HD 1080p maximum' },
        { value: 'medium', label: 'Medium Quality (720p)', description: 'HD 720p maximum' },
        { value: 'low', label: 'Low Quality (480p)', description: 'SD 480p maximum' }
      ];
    }
  }

  private static async downloadDirectMedia(item: MediaItem, signal?: AbortSignal): Promise<void> {
    try {
      // Use CORS proxy for cross-origin downloads
      console.log('Downloading from URL:', item.url);
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.url)}`;
      const response = await fetch(proxyUrl, { signal });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size, 'bytes');
      console.log('Downloaded blob type:', blob.type);
      saveAs(blob, item.filename);
    } catch (error) {
      // Fallback: try direct download (might fail due to CORS)
      try {
        const response = await fetch(item.url, { mode: 'no-cors', signal });
        const blob = await response.blob();
        saveAs(blob, item.filename);
      } catch (fallbackError) {
        // Last resort: create a download link
        this.createDownloadLink(item.url, item.filename);
      }
    }
  }

  private static async downloadBlobVideo(item: MediaItem): Promise<void> {
    try {
      // For blob URLs, we need to fetch the blob data directly
      const response = await fetch(item.url);
      const blob = await response.blob();
      saveAs(blob, item.filename);
    } catch (error) {
      console.error('Failed to download blob video:', error);
      throw error;
    }
  }

  private static async downloadEmbeddedVideo(item: MediaItem, quality?: string, signal?: AbortSignal, onProgress?: (progress: number) => void): Promise<void> {
    console.log('Downloading video from supported platform:', item.url);
    
    // Handle all supported platforms using the unified backend
    if (this.isSupportedPlatform(item.url)) {
      try {
        await this.downloadFromPlatform(item, quality, signal, onProgress);
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
      'tiktok.com'
    ];
    
    return supportedPlatforms.some(platform => url.toLowerCase().includes(platform));
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
    } else {
      return 'Unknown Platform';
    }
  }
  
  private static async downloadFromPlatform(item: MediaItem, quality: string = 'high', signal?: AbortSignal, onProgress?: (progress: number) => void): Promise<void> {
    const downloadServices = [
      // Service 1: Try local yt-dlp backend (most reliable)
      async () => {
        const response = await fetch(API_ENDPOINTS.DOWNLOAD_VIDEO, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: item.url,
            filename: item.filename,
            quality: quality
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
        return;
      }
      // Note: Fallback services removed as they only support YouTube
      // For multi-platform support, we rely on the yt-dlp backend
    ];

    let lastError: Error | null = null;
    
    for (let i = 0; i < downloadServices.length; i++) {
      try {
        console.log(`Trying download service ${i + 1} for ${this.getPlatformName(item.url)}...`);
        await downloadServices[i]();
        console.log(`Successfully downloaded via service ${i + 1}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.log(`Service ${i + 1} failed:`, error);
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
    console.log('Attempting to extract YouTube ID from:', url);
    
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
      console.log('Trying pattern:', pattern, 'Match:', match);
      if (match && match[1] && (match[1].length === 11 || match[1].length === 10)) {
        console.log('Found video ID:', match[1]);
        return match[1];
      }
    }
    
    // Fallback to original pattern
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/videos\/|\/embed\/|\/v\/|\/e\/|watch\?v=|\?v=|&v=|embed\?v=|\/v\/|\/e\/|watch\?v=|\?v=|&v=)([^#&?]*).*/;
    const fallbackMatch = cleanUrl.match(regExp);
    console.log('Fallback match:', fallbackMatch);
    
    const result = (fallbackMatch && fallbackMatch[2] && (fallbackMatch[2].length === 11 || fallbackMatch[2].length === 10)) ? fallbackMatch[2] : '';
    console.log('Final result:', result);
    
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
    
    console.log(ffmpegInstructions);
    
    // For demo purposes, fall back to regular download
    await this.downloadDirectMedia(item);
  }
}