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

interface AudioChannel {
  index: number;
  label: string;
  description: string;
}

export const VideoConverter = () => {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [inputType, setInputType] = useState<'file' | 'url'>('file');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('medium');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioChannels, setAudioChannels] = useState<AudioChannel[]>([]);
  const [hasAudio, setHasAudio] = useState(false);
  const [leftChannel, setLeftChannel] = useState<number | undefined>(undefined);
  const [rightChannel, setRightChannel] = useState<number | undefined>(undefined);
  const [isProbing, setIsProbing] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [hasConverted, setHasConverted] = useState(false);
  const { toast } = useToast();
  
  const conversionOptions = VideoConversionService.getConversionOptions();

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
    setHasAudio(false);
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
        
        // Set default channel mapping for stereo
        if (data.channels.length >= 2) {
          setLeftChannel(0);
          setRightChannel(1);
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
    if (inputType === 'file' && !file) {
      toast({
        title: "Error",
        description: "Please select a video file to convert",
        variant: "destructive",
      });
      return;
    }

    if (inputType === 'url' && !url) {
      toast({
        title: "Error",
        description: "Please enter a valid video URL",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    setProgress(0);
    setConversionError(null);
    setHasConverted(true);

    try {
      await VideoConversionService.convertVideo(
        inputType === 'file' ? file : null,
        inputType === 'url' ? url : null,
        format,
        quality,
        (progressValue) => {
          setProgress(progressValue);
        },
        leftChannel,
        rightChannel
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
    setUrl('');
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

        {/* Input Type Selection */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button
              variant={inputType === 'file' ? 'default' : 'outline'}
              onClick={() => setInputType('file')}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button
              variant={inputType === 'url' ? 'default' : 'outline'}
              onClick={() => setInputType('url')}
              className="flex-1"
            >
              <Video className="w-4 h-4 mr-2" />
              From URL
            </Button>
          </div>

          {/* File Upload */}
          {inputType === 'file' && (
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
          )}

          {/* URL Input */}
          {inputType === 'url' && (
            <div className="space-y-4">
              <div className="relative">
                <Video className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setHasConverted(false);
                    setConversionError(null);
                  }}
                  className="pl-12 h-14 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary transition-smooth"
                  disabled={isConverting}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter a direct link to a video file or a supported platform URL
              </p>
            </div>
          )}
        </Card>

        {/* Conversion Settings */}
        <Card className="p-6 mb-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Conversion Settings</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Output Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conversionOptions.formats.map((fmt) => (
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
          </div>

          {/* Audio Channel Selection */}
          {hasAudio && audioChannels.length > 1 && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h4 className="text-sm font-medium text-foreground">
                  Audio Channel Mapping ({audioChannels.length} channels detected)
                </h4>
              </div>
              
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
              disabled={isConverting || (inputType === 'file' && !file) || (inputType === 'url' && !url)}
            >
              {isConverting ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-5 h-5 mr-2" />
              )}
              {isConverting ? 'Converting...' : 'Convert Video'}
            </Button>
            
            {(file || url) && (
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
      </div>
    </div>
  );
};