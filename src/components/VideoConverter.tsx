import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileVideo, AlertCircle, CheckCircle2, X, RefreshCw, Video, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VideoConversionService } from '@/services/VideoConversionService';

import { API_ENDPOINTS } from '@/config/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Layers, PlayCircle, History, Trash2, FolderOpen, StopCircle } from 'lucide-react';

// File System Access API Types
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

// Augment Window interface
declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

interface AudioChannel {
  index: number;
  label: string;
  description: string;
}

export const VideoConverter = () => {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('medium');
  const [resolution, setResolution] = useState('original');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioChannels, setAudioChannels] = useState<AudioChannel[]>([]);
  const [hasAudio, setHasAudio] = useState<boolean | null>(null); // null = not probed yet, false = no audio, true = has audio
  const [leftChannel, setLeftChannel] = useState<number | undefined>(undefined);
  const [rightChannel, setRightChannel] = useState<number | undefined>(undefined);
  const [isProbing, setIsProbing] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [hasConverted, setHasConverted] = useState(false);


  // Watch Mode State
  const [watchQueue, setWatchQueue] = useState<Array<{
    id: string;
    file: File;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }>>([]);
  const [activeTab, setActiveTab] = useState('manual');

  // Local Watch Folder State
  const [watchHandle, setWatchHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());
  const [watchInterval, setWatchInterval] = useState<NodeJS.Timeout | null>(null);

  // Ref to access watchHandle inside closures (setInterval)
  const watchHandleRef = React.useRef<FileSystemDirectoryHandle | null>(null);

  // Update ref when state changes
  React.useEffect(() => {
    watchHandleRef.current = watchHandle;
  }, [watchHandle]);

  // Refs for settings to avoid stale closures in processing loop
  const formatRef = React.useRef(format);
  const qualityRef = React.useRef(quality);
  const resolutionRef = React.useRef(resolution);
  const leftChannelRef = React.useRef(leftChannel);
  const rightChannelRef = React.useRef(rightChannel);

  React.useEffect(() => {
    formatRef.current = format;
    qualityRef.current = quality;
    resolutionRef.current = resolution;
    leftChannelRef.current = leftChannel;
    rightChannelRef.current = rightChannel;
  }, [format, quality, resolution, leftChannel, rightChannel]);

  const { toast } = useToast();

  const conversionOptions = VideoConversionService.getConversionOptions();

  // Filter out audio-only formats if no audio is detected (only after probing is complete)
  const availableFormats = hasAudio === false
    ? conversionOptions.formats.filter(fmt => !['mp3', 'wav'].includes(fmt.value))
    : conversionOptions.formats; // Show all formats if hasAudio is true or null (not probed yet)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check if it's a video file
      const videoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv', 'video/flv', 'video/wmv', 'video/m4v', 'application/mxf'];
      if (videoTypes.includes(selectedFile.type) || selectedFile.name.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mxf)$/i)) {
        setFile(selectedFile);
        setConversionError(null);
        setHasConverted(false);

        // Probe audio channels
        await probeAudioChannels(selectedFile);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a valid video file (MP4, WebM, AVI, MOV, MKV, FLV, WMV, M4V, MXF)",
          variant: "destructive",
        });
      }
    }
  };

  const probeAudioChannels = async (videoFile: File) => {
    setIsProbing(true);
    setAudioChannels([]);
    setHasAudio(null); // Reset to null during probing
    setLeftChannel(undefined);
    setRightChannel(undefined);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch(API_ENDPOINTS.PROBE_AUDIO, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to probe audio channels');
      }

      const data = await response.json();

      if (data.hasAudio && data.channels.length > 0) {
        setAudioChannels(data.channels);
        setHasAudio(true);

        // Set default channel mapping
        if (data.channels.length >= 2) {
          // Stereo or multi-channel: map first two channels
          setLeftChannel(0);
          setRightChannel(1);
        } else if (data.channels.length === 1) {
          // Mono: map single channel to both left and right
          setLeftChannel(0);
          setRightChannel(0);
        }
      } else if (!data.hasAudio) {
        setAudioChannels([]);
        setHasAudio(false);
        setLeftChannel(null);
        setRightChannel(null);

        // Reset format if currently selected format is audio-only
        if (['mp3', 'wav'].includes(format)) {
          setFormat('mp4'); // Default to MP4 for video-only files
        }

        // Show info message if provided by backend
        if (data.message) {
          toast({
            title: "Video-only file detected",
            description: data.message,
            variant: "default",
          });
        }
      }
    } catch (error) {
      console.error('Error probing audio channels:', error);
      setConversionError('Failed to analyze audio channels');
    } finally {
      setIsProbing(false);
    }
  };

  const handleConvert = async () => {
    console.log('🎬 VideoConverter: handleConvert called', { file: file?.name, format, quality });

    if (!file) {
      console.log('❌ VideoConverter: No file selected');
      toast({
        title: "Error",
        description: "Please select a video file to convert",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    setProgress(0);
    setConversionError(null);
    setHasConverted(true);

    try {
      console.log('🚀 VideoConverter: Starting conversion with VideoConversionService');
      await VideoConversionService.convertVideo(
        file,
        format,
        quality,
        (progressValue) => {
          setProgress(progressValue);
        },
        leftChannel,
        rightChannel,
        resolution
      );

      toast({
        title: "Conversion Complete",
        description: `Video has been converted to ${format.toUpperCase()} format and downloaded`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Conversion failed. Please try again.';
      setConversionError(errorMessage);
      toast({
        title: "Conversion Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setConversionError(null);
    setHasConverted(false);
    setProgress(0);
    setAudioChannels([]);
    setHasAudio(false);
    setLeftChannel(undefined);
    setRightChannel(undefined);
    setIsProbing(false);
    // Reset file input
    const fileInput = document.getElementById('video-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };



  // ---------------------------------------------------------------------------
  // Local Watch Folder Logic (File System Access API)
  // ---------------------------------------------------------------------------
  const handleSelectWatchFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        toast({
          title: "Browser Not Supported",
          description: "Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera.",
          variant: "destructive"
        });
        return;
      }

      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setWatchHandle(handle);
      setIsWatching(true);
      setProcessedFiles(new Set()); // Reset history for new folder

      toast({
        title: "Folder Selected",
        description: `Watching: ${handle.name}`,
      });

      // Start Polling
      startPolling(handle);

    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        toast({
          title: "Error",
          description: "Failed to access folder.",
          variant: "destructive"
        });
      }
    }
  };

  const stopWatching = () => {
    if (watchInterval) {
      clearInterval(watchInterval);
      setWatchInterval(null);
    }
    setIsWatching(false);
    setWatchHandle(null);
  };

  const startPolling = (handle: FileSystemDirectoryHandle) => {
    // Initial scan
    scanWatchFolder(handle);

    // Poll every 5 seconds
    const interval = setInterval(() => {
      scanWatchFolder(handle);
    }, 5000);
    setWatchInterval(interval);
  };



  // Use a Ref for processed files to avoid stale closures in setInterval
  const processedFilesRef = React.useRef<Set<string>>(new Set());

  // Update the scan function to use the Ref
  // Update the scan function to use the Ref
  const scanWatchFolder = async (handle: FileSystemDirectoryHandle) => {
    try {
      console.log('📂 Scanning watch folder:', handle.name);
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const isVideo = entry.name.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mxf)$/i);
          if (isVideo) {
            if (!processedFilesRef.current.has(entry.name)) {
              console.log('✨ New file detected:', entry.name);
              // Add to processed IMMEDIATELY to prevent double-add next poll
              processedFilesRef.current.add(entry.name);

              // Get the file
              const fileHandle = await handle.getFileHandle(entry.name);
              const file = await fileHandle.getFile();

              // Add to Queue
              const newItem = {
                id: Math.random().toString(36).substring(7),
                file: file,
                status: 'queued' as const,
                progress: 0
              };

              setWatchQueue(prev => {
                const newState = [...prev, newItem];
                // Trigger processing if idle (handled by recursive logic, but we need to kickstart if stopped)
                // Actually processNextInQueue handles the "next", but if queue was empty, we need to start it.
                // The original logic calls processNextInQueue immediately after adding.
                // We can't easily call it here with the NEW state.
                // But we can trigger it in a useEffect or just call it with the new array.

                // WORKAROUND: Call processNextInQueue with the new derived state
                // We need to be careful not to create infinite loops or race conditions.
                // The simplistic 'processNextInQueue' takes the queue as arg.
                setTimeout(() => processNextInQueue(newState), 100);
                return newState;
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error scanning folder:", err);
    }
  };



  // Clean up interval on unmount
  React.useEffect(() => {
    return () => {
      if (watchInterval) clearInterval(watchInterval);
    };
  }, [watchInterval]);


  // ---------------------------------------------------------------------------
  // Existing Watch Mode Logic (Drag & Drop)
  // ---------------------------------------------------------------------------
  const handleWatchDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(f =>
      f.type.startsWith('video/') || f.name.match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|mxf)$/i)
    );

    if (videoFiles.length === 0) {
      toast({
        title: "No video files detected",
        description: "Please drop valid video files.",
        variant: "destructive"
      });
      return;
    }

    const newItems = videoFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'queued' as const,
      progress: 0
    }));

    setWatchQueue(prev => [...prev, ...newItems]);
    processNextInQueue([...watchQueue, ...newItems]);
  };

  const processNextInQueue = async (currentQueue: typeof watchQueue) => {
    const processing = currentQueue.find(i => i.status === 'processing');
    if (processing) return; // Already processing something

    const next = currentQueue.find(i => i.status === 'queued');
    if (!next) return; // Nothing to process

    // Mark as processing
    setWatchQueue(prev => prev.map(i =>
      i.id === next.id ? { ...i, status: 'processing' } : i
    ));

    try {
      // Use Ref to check for watch handle (avoids stale closures)
      const currentWatchHandle = watchHandleRef.current;
      const skipDownload = !!currentWatchHandle; // Skip browser download if we have a folder handle


      const resultBlob = await VideoConversionService.convertVideo(
        next.file,
        formatRef.current, // Use Ref to get latest format
        qualityRef.current, // Use Ref to get latest quality
        (progress) => {
          setWatchQueue(prev => prev.map(i =>
            i.id === next.id ? { ...i, progress } : i
          ));
        },
        leftChannelRef.current, // Use Ref
        rightChannelRef.current, // Use Ref
        resolutionRef.current, // Use Ref
        skipDownload
      );

      // Helper to verify permissions
      const verifyPermission = async (fileHandle: FileSystemHandle, readWrite: boolean) => {
        const options = { mode: readWrite ? 'readwrite' : 'read' };
        // @ts-ignore
        if ((await fileHandle.queryPermission(options)) === 'granted') {
          return true;
        }
        // @ts-ignore
        if ((await fileHandle.requestPermission(options)) === 'granted') {
          return true;
        }
        return false;
      };

      // If we are in "Active Watch Mode" (watchHandle exists), save to 'converted_output'
      if (currentWatchHandle && resultBlob instanceof Blob) {

        try {
          console.log('📂 Attempting to save to local file system...');

          // Verify write permission on the directory handle
          const hasPermission = await verifyPermission(currentWatchHandle, true);
          if (!hasPermission) {
            throw new Error('Write permission denied by user');
          }

          // 1. Get or Create 'converted_output' folder
          console.log('📂 Getting/Creating output directory...');
          const outputDir = await currentWatchHandle.getDirectoryHandle('converted_output', { create: true });

          // 2. Create file handle
          const newFileName = `converted_${next.file.name.substring(0, next.file.name.lastIndexOf('.'))}.${formatRef.current}`;
          console.log(`📂 Creating file: ${newFileName}`);
          const fileHandle = await outputDir.getFileHandle(newFileName, { create: true });

          // 3. Write data
          console.log('📂 Writing data...');
          // @ts-ignore - TS might complain about createWritable not being standard yet
          const writable = await fileHandle.createWritable();
          await writable.write(resultBlob);
          await writable.close();
          console.log('✅ File write complete.');

          toast({
            title: "File Saved",
            description: `Saved to converted_output/${newFileName}`,
          });

        } catch (fsError) {
          console.error('File System Write Error:', fsError);
          // Show persistent error toast
          toast({
            title: "Save Failed",
            description: `Could not save file: ${(fsError as Error).message}. Check browser permissions.`,
            variant: "destructive",
            duration: 10000,
          });
          throw new Error(`Failed to write to disk: ${(fsError as Error).message}`);
        }
      } else {
        // Standard Auto-Download (handled by Service if skipDownload=false, or if we want to handle it here?)
        // Currently Service handles it if skipDownload=false.
        // If skipDownload=true, we get blob, but if watchHandle is null (meaning manual drop), we SHOULD download it.
        // Logic fix:
        // if watchHandle is present -> skipDownload=true -> save to FS.
        // if watchHandle is null -> skipDownload=false -> Service downloads.
        // The only case where resultBlob is returned is if skipDownload=true.
        // So we are good.
      }

      setWatchQueue(prev => prev.map(i =>
        i.id === next.id ? { ...i, status: 'completed', progress: 100 } : i
      ));

      toast({
        title: "Auto-Process Complete",
        description: `${next.file.name} converted successfully.`,
      });

    } catch (error) {
      setWatchQueue(prev => prev.map(i =>
        i.id === next.id ? { ...i, status: 'failed', error: error instanceof Error ? error.message : 'Failed' } : i
      ));
    }

    // Trigger next recursive call after state update (using timeout to allow react cycle)
    setTimeout(() => {
      setWatchQueue(prev => {
        processNextInQueue(prev);
        return prev;
      });
    }, 500);
  };

  const removeFromQueue = (id: string) => {
    setWatchQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearCompleted = () => {
    setWatchQueue(prev => prev.filter(i => i.status !== 'completed'));
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-primary">
              <RefreshCw className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Video Converter
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Convert your videos to different formats with high quality and fast processing
          </p>
        </div>

        <Tabs defaultValue="manual" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-lg grid-cols-2 h-14 bg-muted/50 p-1 rounded-full border border-border/50 backdrop-blur-sm">
              <TabsTrigger
                value="manual"
                className="rounded-full text-base font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-300 flex items-center justify-center gap-2"
              >
                <FileVideo className="w-4 h-4" />
                Manual Mode
              </TabsTrigger>
              <TabsTrigger
                value="watch"
                className="rounded-full text-base font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Watch Folder Mode
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="manual">
            {/* File Upload */}
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Upload Video File</h3>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="video-file"
                    type="file"
                    accept="video/*,.mp4,.webm,.avi,.mov,.mkv,.flv,.wmv,.m4v,.mxf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="video-file" className="cursor-pointer">
                    <FileVideo className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    {file ? (
                      <div>
                        <p className="text-lg font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-medium text-foreground mb-2">
                          Click to select a video file
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Supports MP4, WebM, AVI, MOV, MKV, FLV, WMV, M4V, MXF
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </Card>

            {/* Conversion Settings */}
            <Card className="p-6 mb-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Conversion Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Format Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Output Format</label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFormats.map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{fmt.label}</span>
                            <span className="text-xs text-muted-foreground">{fmt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Quality</label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conversionOptions.qualities.map((qual) => (
                        <SelectItem key={qual.value} value={qual.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{qual.label}</span>
                            <span className="text-xs text-muted-foreground">{qual.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Resolution Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Resolution</label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">
                        <div className="flex flex-col">
                          <span className="font-medium">Original</span>
                          <span className="text-xs text-muted-foreground">Keep original resolution</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="1920x1080">
                        <div className="flex flex-col">
                          <span className="font-medium">1920×1080 (Full HD)</span>
                          <span className="text-xs text-muted-foreground">Standard HD resolution</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="1280x720">
                        <div className="flex flex-col">
                          <span className="font-medium">1280×720 (HD)</span>
                          <span className="text-xs text-muted-foreground">HD resolution</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="854x480">
                        <div className="flex flex-col">
                          <span className="font-medium">854×480 (SD)</span>
                          <span className="text-xs text-muted-foreground">Standard definition</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Audio Channel Selection */}
              {hasAudio && audioChannels.length > 0 && (
                <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h4 className="text-sm font-medium text-foreground">
                      Audio Channel Mapping ({audioChannels.length} channel{audioChannels.length > 1 ? 's' : ''} detected)
                    </h4>
                  </div>

                  {audioChannels.length === 1 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Mono audio detected. The single channel will be mapped to both left and right output channels.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Channel Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Left Channel</label>
                      <Select
                        value={leftChannel?.toString() || ''}
                        onValueChange={(value) => setLeftChannel(parseInt(value))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select left channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {audioChannels.map((channel) => (
                            <SelectItem key={channel.index} value={channel.index.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{channel.label}</span>
                                <span className="text-xs text-muted-foreground">{channel.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Right Channel Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Right Channel</label>
                      <Select
                        value={rightChannel?.toString() || ''}
                        onValueChange={(value) => setRightChannel(parseInt(value))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select right channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {audioChannels.map((channel) => (
                            <SelectItem key={channel.index} value={channel.index.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{channel.label}</span>
                                <span className="text-xs text-muted-foreground">{channel.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Select which audio channels to map to the left and right stereo output channels.
                  </p>
                </div>
              )}

              {/* Audio Probing Status */}
              {isProbing && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Analyzing audio channels...
                    </span>
                  </div>
                </div>
              )}

              {/* Convert Button */}
              <div className="mt-6 flex gap-4">
                <Button
                  onClick={handleConvert}
                  className="flex-1 h-14 text-lg"
                  disabled={isConverting || !file}
                >
                  {isConverting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-5 h-5 mr-2" />
                  )}
                  {isConverting ? 'Converting...' : 'Convert Video'}
                </Button>

                {file && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="h-14 px-6"
                    disabled={isConverting}
                  >
                    Reset
                  </Button>
                )}
              </div>

              {isConverting && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Converting video to {format.toUpperCase()} format...
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </Card>

            {/* Error State */}
            {!isConverting && conversionError && (
              <Card className="p-12 text-center shadow-card bg-gradient-to-br from-destructive/5 to-destructive/10 backdrop-blur-sm border-destructive/20">
                <div className="max-w-md mx-auto">
                  <div className="p-4 rounded-full bg-destructive/10 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Conversion Failed</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {conversionError}
                  </p>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConversionError(null);
                          handleConvert();
                        }}
                        className="text-xs"
                      >
                        Try Again
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetForm}
                        className="text-xs"
                      >
                        Reset Form
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Success State */}
            {!isConverting && !conversionError && hasConverted && progress === 100 && (
              <Card className="p-12 text-center shadow-card bg-gradient-to-br from-green-500/5 to-green-600/10 backdrop-blur-sm border-green-500/20">
                <div className="max-w-md mx-auto">
                  <div className="p-4 rounded-full bg-green-500/10 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <Download className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Conversion Complete!</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Your video has been successfully converted to {format.toUpperCase()} format and downloaded.
                  </p>
                  <Button
                    onClick={resetForm}
                    className="text-sm"
                  >
                    Convert Another Video
                  </Button>
                </div>
              </Card>
            )}

          </TabsContent>

          <TabsContent value="watch">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Col: Settings & Drop Zone */}
              <div className="lg:col-span-2 space-y-6">
                {/* Watch Settings */}
                <Card className="p-6 shadow-card border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Watch Configuration</h3>
                  </div>
                  {/* Reusing the same settings controls for consistency */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Format</label>
                      <Select value={format} onValueChange={setFormat}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableFormats.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Quality</label>
                      <Select value={quality} onValueChange={setQuality}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {conversionOptions.qualities.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Resolution</label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">Original</SelectItem>
                          <SelectItem value="1920x1080">1080p</SelectItem>
                          <SelectItem value="1280x720">720p</SelectItem>
                          <SelectItem value="854x480">480p</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                {/* Watch Drop Zone */}
                <Card
                  className="p-12 border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer relative overflow-hidden"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); }}
                  onDrop={(e) => { e.currentTarget.classList.remove('border-primary'); handleWatchDrop(e); }}
                >
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-primary/20 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                      <PlayCircle className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">Watch Drop Zone</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Files dropped here will be <span className="text-primary font-bold">automatically processed</span> using the settings above.
                    </p>
                  </div>
                  {/* Visual Scanner Effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.5)] animate-[scan_2s_ease-in-out_infinite]" />
                </Card>

                {/* Local Folder Selection (Active Watch) */}
                <Card className="p-6 shadow-card border-primary/20 bg-muted/20">
                  <div className="flex items-center gap-2 mb-4">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Local Watch Folder</h3>
                  </div>

                  {!isWatching ? (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Select a local folder to constantly watch. Any video added to it will be automatically converted.
                      </p>
                      <Button onClick={handleSelectWatchFolder} variant="outline" className="w-full border-dashed h-12">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Select Folder to Watch
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-background border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="font-medium truncate text-sm" title={watchHandle?.name}>
                            Watching: {watchHandle?.name}
                          </span>
                        </div>
                        <Button onClick={() => {
                          stopWatching();
                          // handleSelectWatchFolder(); // Allow re-select? Or just stop?
                        }} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                          <StopCircle className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Scanning every 5s. Output will be saved to <b>/converted_output</b> subfolder.
                      </p>
                      <Button onClick={stopWatching} variant="destructive" size="sm" className="w-full mt-3 h-8 text-xs">
                        Stop Watching
                      </Button>
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Col: Activity Log */}
              <div className="lg:col-span-1">
                <Card className="h-full flex flex-col shadow-card">
                  <div className="p-4 border-b flex justify-between items-center bg-muted/30">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-semibold">Activity Queue</h3>
                    </div>
                    {watchQueue.some(i => i.status === 'completed') && (
                      <Button variant="ghost" size="sm" onClick={clearCompleted} className="h-8 text-xs">
                        Clear Done
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="flex-1 p-4 h-[500px]">
                    {watchQueue.length === 0 ? (
                      <div className="text-center text-muted-foreground py-10 opacity-50">
                        <Layers className="w-12 h-12 mx-auto mb-2" />
                        <p>Queue is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {watchQueue.map((item) => (
                          <div key={item.id} className="bg-background border rounded-lg p-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium truncate max-w-[150px]" title={item.file.name}>{item.file.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={() => removeFromQueue(item.id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <Badge variant={
                                item.status === 'completed' ? 'default' :
                                  item.status === 'failed' ? 'destructive' :
                                    item.status === 'processing' ? 'secondary' : 'outline'
                              } className={item.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''}>
                                {item.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                {item.status.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{(item.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            </div>
                            {item.status === 'processing' && <Progress value={item.progress} className="h-1.5" />}
                            {item.error && <p className="text-xs text-destructive mt-1">{item.error}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
};