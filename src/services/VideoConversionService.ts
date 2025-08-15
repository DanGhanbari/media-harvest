import { API_ENDPOINTS } from '../config/api';

export interface ConversionRequest {
  url?: string;
  format: string;
  quality: string;
  leftChannel?: number;
  rightChannel?: number;
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
    file: File | null,
    url: string | null,
    format: string,
    quality: string,
    onProgress?: (progress: number) => void,
    leftChannel?: number,
    rightChannel?: number
  ): Promise<void> {
    const conversionId = file ? file.name : url || 'unknown';
    
    // Check if conversion is already active
    if (this.activeConversions.has(conversionId)) {
      throw new Error('Conversion already in progress for this item');
    }

    const abortController = new AbortController();
    this.activeConversions.set(conversionId, abortController);

    try {
      const formData = new FormData();
      
      if (file) {
        formData.append('video', file);
      } else if (url) {
        formData.append('url', url);
      } else {
        throw new Error('No video file or URL provided');
      }
      
      formData.append('format', format);
      formData.append('quality', quality);
      
      // Add channel selection if specified
      if (leftChannel !== undefined && rightChannel !== undefined) {
        formData.append('leftChannel', leftChannel.toString());
        formData.append('rightChannel', rightChannel.toString());
      }

      const response = await fetch(API_ENDPOINTS.CONVERT_VIDEO, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

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