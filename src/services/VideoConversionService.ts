import { API_ENDPOINTS } from '../config/api';

export interface ConversionRequest {
  format: string;
  quality: string;
  leftChannel?: number;
  rightChannel?: number;
  resolution?: string;
  sessionId?: string;
}

interface ProgressDetails {
  currentTime?: string;
  totalTime?: string;
  fps?: number;
  speed?: string;
  bitrate?: string;
}

export interface ConversionOptions {
  formats: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  qualities: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

export class VideoConversionService {
  private static activeConversions = new Map<string, AbortController>();
  private static ws: WebSocket | null = null;
  private static progressCallbacks = new Map<string, (progress: number, details?: ProgressDetails) => void>();
  private static sessionId: string = Math.random().toString(36).substring(2, 15);

  static initWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected for conversion progress tracking');
      // Register session with server
      this.ws?.send(JSON.stringify({
        type: 'register',
        sessionId: this.sessionId
      }));
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('VideoConversionService: Received WebSocket message', data);
        if (data.type === 'progress') {
          const callback = this.progressCallbacks.get(data.operation);
          console.log('VideoConversionService: Looking for callback for operation:', data.operation, 'Found:', !!callback);
          if (callback) {
            console.log('VideoConversionService: Calling progress callback with progress:', data.progress);
            callback(data.progress, data);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;
      // Attempt to reconnect after 3 seconds
      setTimeout(() => this.initWebSocket(), 3000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  static getConversionOptions(): ConversionOptions {
    return {
      formats: [
        { value: 'mp4', label: 'MP4', description: 'Most compatible video format' },
        { value: 'webm', label: 'WebM', description: 'Web-optimized format' },
        { value: 'avi', label: 'AVI', description: 'Classic video format' },
        { value: 'mov', label: 'MOV', description: 'QuickTime format' },
        { value: 'mkv', label: 'MKV', description: 'Matroska video format' },
        { value: 'mp3', label: 'MP3', description: 'Audio only (MP3)' },
        { value: 'wav', label: 'WAV', description: 'Audio only (WAV)' },
      ],
      qualities: [
        { value: 'low', label: 'Low Quality', description: 'Smaller file size, faster conversion' },
        { value: 'medium', label: 'Medium Quality', description: 'Balanced quality and size' },
        { value: 'high', label: 'High Quality', description: 'Best quality, larger file size' },
      ],
    };
  }

  static async convertVideo(
    file: File,
    format: string,
    quality: string,
    onProgress?: (progress: number) => void,
    leftChannel?: number,
    rightChannel?: number,
    resolution?: string
  ): Promise<void> {
    console.log('VideoConversionService: Starting conversion', { file: file.name, format, quality, sessionId: this.sessionId });
    
    const conversionId = file.name;
    
    // Check if conversion is already active
    if (this.activeConversions.has(conversionId)) {
      throw new Error('Conversion already in progress for this item');
    }

    // Initialize WebSocket connection
    this.initWebSocket();

    // Register progress callback for this conversion
    if (onProgress) {
      console.log('VideoConversionService: Registering progress callback');
      this.progressCallbacks.set('conversion', onProgress);
    }

    const abortController = new AbortController();
    this.activeConversions.set(conversionId, abortController);

    try {
      const formData = new FormData();
      
      formData.append('video', file);
      
      formData.append('format', format);
      formData.append('quality', quality);
      
      // Add session ID for progress tracking
      formData.append('sessionId', this.sessionId);
      
      // Add channel selection if specified
      if (leftChannel !== undefined && leftChannel !== null && rightChannel !== undefined && rightChannel !== null) {
        formData.append('leftChannel', leftChannel.toString());
        formData.append('rightChannel', rightChannel.toString());
      }
      
      // Add resolution if specified
      if (resolution && resolution !== 'original') {
        formData.append('resolution', resolution);
      }

      console.log('VideoConversionService: Making fetch request to', API_ENDPOINTS.CONVERT_VIDEO);
      const response = await fetch(API_ENDPOINTS.CONVERT_VIDEO, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });
      console.log('VideoConversionService: Fetch response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Handle file download
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `converted_video.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      if (onProgress) {
        onProgress(100);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Conversion was cancelled');
      }
      throw error;
    } finally {
      this.activeConversions.delete(conversionId);
      // Unregister progress callback
      this.progressCallbacks.delete('conversion');
    }
  }

  static cancelConversion(conversionId: string): void {
    const controller = this.activeConversions.get(conversionId);
    if (controller) {
      controller.abort();
      this.activeConversions.delete(conversionId);
    }
  }

  static isConversionActive(conversionId: string): boolean {
    return this.activeConversions.has(conversionId);
  }

  static cancelAllConversions(): void {
    this.activeConversions.forEach((controller) => {
      controller.abort();
    });
    this.activeConversions.clear();
  }
}