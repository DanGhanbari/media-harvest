export interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'audio' | 'other';
  filename: string;
  size?: string;
  dimensions?: string;
  thumbnail?: string;
}

export class MediaDetectionService {
  private static readonly CORS_PROXY = 'https://api.allorigins.win/raw?url=';
  private static fileCounter = 1;
  
  static async detectMedia(url: string): Promise<MediaItem[]> {
    // Reset counter for each new page analysis
    this.fileCounter = 1;
    
    const mediaItems: MediaItem[] = [];
    
    // Handle social media platform URLs specially
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return this.handleYouTubeUrl(url);
    }
    
    if (url.includes('instagram.com')) {
      return this.handleInstagramUrl(url);
    }
    
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
      return this.handleFacebookUrl(url);
    }
    
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return this.handleTwitterUrl(url);
    }
    
    if (url.includes('tiktok.com')) {
      return this.handleTikTokUrl(url);
    }
    
    try {
      // Use CORS proxy to fetch the webpage content
      const proxyUrl = `${this.CORS_PROXY}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch webpage: ${response.status}`);
      }
      
      let htmlContent;
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        htmlContent = data.contents;
      } else {
        // For raw endpoint, we get the HTML directly
        htmlContent = await response.text();
      }
      
      // Parse HTML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract images
      const images = this.extractImages(doc, url);
      mediaItems.push(...images);
      
      // Extract videos
      const videos = this.extractVideos(doc, url);
      mediaItems.push(...videos);
      
      // Extract audio
      const audio = this.extractAudio(doc, url);
      mediaItems.push(...audio);
      
      // Extract media from CSS background images
      const cssMedia = this.extractCSSMedia(doc, url);
      mediaItems.push(...cssMedia);
      
      // Remove duplicates based on URL
      const uniqueMedia = mediaItems.filter((item, index, self) => 
        index === self.findIndex(t => t.url === item.url)
      );
      
      return uniqueMedia;
    } catch (error) {
      console.error('Error detecting media:', error);
      
      // Throw the error so the UI can handle it appropriately
      throw new Error(`Failed to analyze webpage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static handleYouTubeUrl(url: string): MediaItem[] {
    const videoId = this.extractYouTubeId(url);
    const filename = this.extractFilename(url);
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : undefined
    }];
  }
  
  private static handleInstagramUrl(url: string): MediaItem[] {
    const filename = this.extractFilename(url);
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`
    }];
  }
  
  private static handleFacebookUrl(url: string): MediaItem[] {
    const filename = this.extractFilename(url);
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`
    }];
  }
  
  private static handleTwitterUrl(url: string): MediaItem[] {
    const filename = this.extractFilename(url);
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`
    }];
  }
  
  private static handleTikTokUrl(url: string): MediaItem[] {
    const filename = this.extractFilename(url);
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`
    }];
  }
  
  private static extractYouTubeId(url: string): string | null {
    const patterns = [
      /youtu\.be\/([^/]+)/,
      /youtube\.com\/watch\?v=([^/&]+)/,
      /youtube\.com\/embed\/([^/]+)/,
      /youtube\.com\/v\/([^/]+)/
    ];
    
    // Clean URL by removing fragments and the '?si=' parameter
    const cleanUrl = url.split('#')[0].split('?si=')[0];
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1] && (match[1].length === 11 || match[1].length === 10)) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractInstagramId(url: string): string | null {
    const patterns = [
      /instagram\.com\/p\/([^/?]+)/,
      /instagram\.com\/reel\/([^/?]+)/,
      /instagram\.com\/tv\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractFacebookId(url: string): string | null {
    const patterns = [
      /facebook\.com\/watch\?v=([^&]+)/,
      /facebook\.com\/.*\/videos\/([^/?]+)/,
      /fb\.watch\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractTwitterId(url: string): string | null {
    const patterns = [
      /twitter\.com\/.*\/status\/([^/?]+)/,
      /x\.com\/.*\/status\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractTikTokId(url: string): string | null {
    const patterns = [
      /tiktok\.com\/@[^/]+\/video\/([^/?]+)/,
      /tiktok\.com\/t\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractImages(doc: Document, baseUrl: string): MediaItem[] {
    const images: MediaItem[] = [];
    const imgElements = doc.querySelectorAll('img');
    
    imgElements.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        const filename = this.extractFilename(absoluteUrl) || 'image';
        
        images.push({
          url: absoluteUrl,
          type: 'image',
          filename: `${filename}.${this.getFileExtension(absoluteUrl) || 'jpg'}`,
          dimensions: img.naturalWidth && img.naturalHeight ? 
            `${img.naturalWidth}x${img.naturalHeight}` : undefined,
          thumbnail: absoluteUrl
        });
      }
    });
    
    return images;
  }
  
  private static extractVideos(doc: Document, baseUrl: string): MediaItem[] {
    const videos: MediaItem[] = [];
    
    // Extract from video elements
    const videoElements = doc.querySelectorAll('video');
    videoElements.forEach(video => {
      const src = video.getAttribute('src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        videos.push({
          url: absoluteUrl,
          type: 'video',
          filename: `${this.extractFilename(absoluteUrl) || 'video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`,
          thumbnail: video.getAttribute('poster') ? this.resolveUrl(video.getAttribute('poster')!, baseUrl) : undefined
        });
      }
      
      // Check source elements
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        const src = source.getAttribute('src');
        if (src) {
          const absoluteUrl = this.resolveUrl(src, baseUrl);
          videos.push({
            url: absoluteUrl,
            type: 'video',
            filename: `${this.extractFilename(absoluteUrl) || 'video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`,
            thumbnail: video.getAttribute('poster') ? this.resolveUrl(video.getAttribute('poster')!, baseUrl) : undefined
          });
        }
      });
    });
    
    // Extract from meta tags (Open Graph, Twitter Cards)
    const metaTags = doc.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const property = meta.getAttribute('property') || meta.getAttribute('name');
      const content = meta.getAttribute('content');
      
      if (content && property) {
        // Open Graph video tags
        if (property === 'og:video' || property === 'og:video:url' || property === 'og:video:secure_url') {
          const absoluteUrl = this.resolveUrl(content, baseUrl);
          videos.push({
            url: absoluteUrl,
            type: 'video',
            filename: `${this.extractFilename(absoluteUrl) || 'og-video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
          });
        }
        
        // Twitter Card video tags
        if (property === 'twitter:player' || property === 'twitter:player:stream') {
          const absoluteUrl = this.resolveUrl(content, baseUrl);
          videos.push({
            url: absoluteUrl,
            type: 'video',
            filename: `${this.extractFilename(absoluteUrl) || 'twitter-video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
          });
        }
      }
    });
    
    // Extract from iframes (YouTube, Vimeo, Dailymotion, etc.)
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src');
      if (src) {
        const videoHosts = [
          'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 
          'twitch.tv', 'streamable.com', 'wistia.com', 'brightcove.com',
          'jwplayer.com', 'kaltura.com', 'vidyard.com'
        ];
        
        if (videoHosts.some(host => src.includes(host))) {
          videos.push({
            url: src,
            type: 'video',
            filename: `${this.extractFilename(src) || 'embedded-video'}.mp4`
          });
        }
      }
    });
    
    // Extract from data attributes and common video patterns
    const elementsWithVideoData = doc.querySelectorAll('[data-video-url], [data-src*=".mp4"], [data-src*=".webm"], [data-src*=".mov"], [data-src*=".avi"]');
    elementsWithVideoData.forEach(element => {
      const videoUrl = element.getAttribute('data-video-url') || element.getAttribute('data-src');
      if (videoUrl) {
        const absoluteUrl = this.resolveUrl(videoUrl, baseUrl);
        videos.push({
          url: absoluteUrl,
          type: 'video',
          filename: `${this.extractFilename(absoluteUrl) || 'data-video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
        });
      }
    });
    
    // Extract from links pointing to video files
    const videoLinks = doc.querySelectorAll('a[href*=".mp4"], a[href*=".webm"], a[href*=".mov"], a[href*=".avi"], a[href*=".mkv"], a[href*=".flv"], a[href*=".wmv"]');
    videoLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const absoluteUrl = this.resolveUrl(href, baseUrl);
        videos.push({
          url: absoluteUrl,
          type: 'video',
          filename: `${this.extractFilename(absoluteUrl) || 'linked-video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
        });
      }
    });
    
    return videos;
  }
  
  private static extractAudio(doc: Document, baseUrl: string): MediaItem[] {
    const audio: MediaItem[] = [];
    
    const audioElements = doc.querySelectorAll('audio');
    audioElements.forEach(audioEl => {
      const src = audioEl.getAttribute('src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        audio.push({
          url: absoluteUrl,
          type: 'audio',
          filename: `${this.extractFilename(absoluteUrl) || 'audio'}.${this.getFileExtension(absoluteUrl) || 'mp3'}`
        });
      }
    });
    
    return audio;
  }
  
  private static extractCSSMedia(doc: Document, baseUrl: string): MediaItem[] {
    const media: MediaItem[] = [];
    
    // Extract background images from style attributes and CSS
    const elementsWithStyle = doc.querySelectorAll('[style*="background"]');
    elementsWithStyle.forEach(element => {
      const style = element.getAttribute('style') || '';
      const bgImageMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
      if (bgImageMatch) {
        const url = this.resolveUrl(bgImageMatch[1], baseUrl);
        media.push({
          url,
          type: 'image',
          filename: `${this.extractFilename(url) || 'background'}.${this.getFileExtension(url) || 'jpg'}`,
          thumbnail: url
        });
      }
    });
    
    return media;
  }
  
  private static resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }
  
  private static extractFilename(url: string): string {
    const filename = `MediaHarvest${this.fileCounter}`;
    this.fileCounter++;
    return filename;
  }
  
  private static getFileExtension(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  

}