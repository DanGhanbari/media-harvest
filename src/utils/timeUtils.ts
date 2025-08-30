/**
 * Utility functions for time formatting and conversion
 */

/**
 * Convert seconds to MM:SS or HH:MM:SS format
 * @param seconds - Total seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Convert MM:SS or HH:MM:SS format to seconds
 * @param timeString - Time string in MM:SS or HH:MM:SS format
 * @returns Total seconds
 */
export function parseTimeToSeconds(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':').map(part => parseInt(part.trim(), 10));
  
  if (parts.some(part => isNaN(part) || part < 0)) return 0;
  
  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    if (seconds >= 60) return 0; // Invalid seconds
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) return 0; // Invalid minutes or seconds
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return 0;
}

/**
 * Validate time string format
 * @param timeString - Time string to validate
 * @returns True if valid MM:SS or HH:MM:SS format
 */
export function isValidTimeFormat(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') return false;
  
  const timeRegex = /^(?:([0-9]+):)?([0-5]?[0-9]):([0-5]?[0-9])$|^([0-5]?[0-9]):([0-5]?[0-9])$/;
  return timeRegex.test(timeString.trim());
}

/**
 * Get duration string for display (e.g., "2h 30m", "45m 20s", "1m 15s")
 * @param seconds - Total seconds
 * @returns Human-readable duration string
 */
export function getDurationString(seconds: number): string {
  if (seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }
  
  return parts.join(' ');
}