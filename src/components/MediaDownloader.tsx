import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  Download,
  Globe,
  Image,
  Video,
  Music,
  FileImage,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  MediaDetectionService,
  MediaItem,
} from "@/services/MediaDetectionService";
import { MediaGrid } from "@/components/MediaGrid";
import TimeRangeSelector from "@/components/TimeRangeSelector";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { DownloadService, QualityOption } from "@/services/DownloadService";
import { formatTime } from "@/utils/timeUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Removed CookieUpload import - using automated cookie extraction

export const MediaDownloader = () => {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [videoInfo, setVideoInfo] = useState<{ [key: string]: { duration: number, title: string } }>({});
  const [showTimeSelector, setShowTimeSelector] = useState<{ [key: string]: boolean }>({});
  const [selectedTimeRanges, setSelectedTimeRanges] = useState<{ [key: string]: { start: number, end: number } }>({});
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<{ [key: string]: string }>({});
  const [segmentDownloading, setSegmentDownloading] = useState<{ [key: string]: boolean }>({});
  const [segmentProgress, setSegmentProgress] = useState<{ [key: string]: number }>({});
  const { toast } = useToast();

  // Load quality options on component mount
  React.useEffect(() => {
    DownloadService.getQualityOptions().then(setQualityOptions);
  }, []);

  const handleAnalyze = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setMediaItems([]);
    setAnalysisError(null);
    setHasAnalyzed(true);
    setVideoInfo({});
    setShowTimeSelector({});
    setSelectedTimeRanges({});
    setSelectedQuality({});

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const items = await MediaDetectionService.detectMedia(url);

      // Check for YouTube videos and get their duration info
      console.log('=== ANALYSIS PROCESS START ===');
      console.log('Processing media items:', items);
      const newVideoInfo: { [key: string]: { duration: number, title: string } } = {};

      for (const item of items) {
        console.log('\n--- Processing item ---');
        console.log('Item URL:', item.url);
        console.log('Item type:', item.type);
        console.log('Is YouTube URL?', item.url.includes('youtube.com') || item.url.includes('youtu.be'));

        if (item.type === 'video' && (item.url.includes('youtube.com') || item.url.includes('youtu.be'))) {
          console.log('✓ YouTube video detected, fetching info...');
          try {
            const videoData = await DownloadService.checkIfLongVideo(item.url);
            console.log('Raw video data received:', JSON.stringify(videoData, null, 2));

            if (videoData && videoData.videoInfo) {
              const duration = videoData.videoInfo.duration || videoData.duration;
              const title = videoData.videoInfo.title || 'Unknown Video';
              console.log('Extracted duration:', duration, 'seconds');
              console.log('Extracted title:', title);
              console.log('Duration > 960 seconds?', duration > 960);

              newVideoInfo[item.url] = { duration, title };
              console.log('✓ Video info stored for', item.url, ':', newVideoInfo[item.url]);
            } else {
              console.warn('⚠️ No videoInfo in response:', videoData);
            }
          } catch (error) {
            console.error('❌ Error fetching video info:', error);
          }
        } else {
          console.log('⏭️ Skipping non-YouTube video or non-video item');
        }
      }

      console.log('\n=== FINAL RESULTS ===');
      console.log('Final videoInfo state:', JSON.stringify(newVideoInfo, null, 2));
      console.log('Number of videos processed:', Object.keys(newVideoInfo).length);
      setVideoInfo(newVideoInfo);
      console.log('=== ANALYSIS PROCESS END ===\n');

      clearInterval(progressInterval);
      setProgress(100);
      setMediaItems(items);

      toast({
        title: "Analysis Complete",
        description: `Found ${items.length} media items`,
      });
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Could not analyze the webpage. Please check the URL and try again."
      );
      toast({
        title: "Analysis Failed",
        description:
          "Could not analyze the webpage. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      case "audio":
        return <Music className="w-5 h-5" />;
      default:
        return <FileImage className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl gradient-primary shadow-glow">
              <Download className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Media Harvest
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Extract and download all media content from any webpage, including
            images, videos, and audio files
          </p>
        </div>

        {/* URL Input */}
        <Card className="p-4 md:p-8 mb-8 shadow-card">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://example.com/page-with-media"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setHasAnalyzed(false);
                    setAnalysisError(null);
                    setMediaItems([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url && !isAnalyzing) {
                      handleAnalyze();
                    }
                  }}
                  className="pl-12 h-14 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary transition-smooth"
                  disabled={isAnalyzing}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAnalyze}
                  className="h-14 px-8 text-lg w-full sm:w-auto"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>

              </div>
            </div>
          </div>

          {isAnalyzing && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Scanning webpage for media content...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>

        {/* Removed manual cookie upload - now using automated browser cookie extraction */}

        {/* Results */}
        {mediaItems.length > 0 && (
          <div className="space-y-6">
            {/* Stats */}
            <Card className="p-6 shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Items",
                    value: mediaItems.length,
                    icon: <FileImage />,
                  },
                  {
                    label: "Images",
                    value: mediaItems.filter((item) => item.type === "image")
                      .length,
                    icon: <Image />,
                  },
                  {
                    label: "Videos",
                    value: mediaItems.filter((item) => item.type === "video")
                      .length,
                    icon: <Video />,
                  },
                  {
                    label: "Audio",
                    value: mediaItems.filter((item) => item.type === "audio")
                      .length,
                    icon: <Music />,
                  },
                ].map((stat, index) => (
                  <div
                    key={index}
                    className="text-center p-4 rounded-xl gradient-secondary"
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-3">
                      {React.cloneElement(stat.icon, {
                        className: "w-6 h-6 text-primary-foreground",
                      })}
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Media Grid */}
            <MediaGrid items={mediaItems} />

            {/* Time Range Selector - positioned after media grid */}
            {(() => {
              console.log('\n=== TIME SELECTOR RENDER CHECK ===');
              console.log('mediaItems.length:', mediaItems.length);
              console.log('mediaItems:', mediaItems);
              console.log('videoInfo state:', videoInfo);

              const hasLongYouTubeVideo = mediaItems.some(item => {
                const isVideo = item.type === 'video';
                const isYouTube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
                const hasVideoInfo = videoInfo[item.url];
                const isLong = hasVideoInfo && videoInfo[item.url].duration > 960;

                console.log(`Item ${item.url}:`);
                console.log('  - Is video:', isVideo);
                console.log('  - Is YouTube:', isYouTube);
                console.log('  - Has video info:', !!hasVideoInfo);
                console.log('  - Duration:', hasVideoInfo ? videoInfo[item.url].duration : 'N/A');
                console.log('  - Is long (>960s):', isLong);

                return isVideo && isYouTube && hasVideoInfo && isLong;
              });

              console.log('Should show TimeRangeSelector:', hasLongYouTubeVideo);
              console.log('=== END TIME SELECTOR CHECK ===\n');

              return hasLongYouTubeVideo ? (
                <Card className="p-8 mb-8 shadow-card">
                  <div className="space-y-6">
                    {mediaItems
                      .filter(item =>
                        item.type === 'video' &&
                        (item.url.includes('youtube.com') || item.url.includes('youtu.be')) &&
                        videoInfo[item.url] &&
                        videoInfo[item.url].duration > 960
                      )
                      .map(item => (
                        <div key={item.url} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              <Clock className="w-3 h-3 mr-1" />
                              Long Video Detected
                            </Badge>
                            <h3 className="text-lg font-semibold text-foreground">Time Range Selection</h3>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            This video is longer than 16 minutes. You can select a specific time range to download.
                          </div>

                          {/* Quality Selector */}
                          <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30 backdrop-blur-sm">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                              Quality Settings:
                            </label>
                            <Select
                              value={selectedQuality[item.url] || 'high'}
                              onValueChange={(value) => {
                                setSelectedQuality(prev => ({ ...prev, [item.url]: value }));
                              }}
                            >
                              <SelectTrigger className="w-full bg-background/50 border-border/50 hover:border-primary/50 transition-colors duration-200">
                                <SelectValue placeholder="Select quality" />
                              </SelectTrigger>
                              <SelectContent>
                                {qualityOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex flex-col">
                                      <span>{option.label}</span>
                                      <span className="text-xs text-muted-foreground">{option.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <TimeRangeSelector
                            videoDuration={videoInfo[item.url].duration}
                            videoTitle={videoInfo[item.url].title}
                            isDownloading={segmentDownloading[item.url] || false}
                            downloadProgress={segmentProgress[item.url] || 0}
                            onTimeRangeChange={async (startTime, endTime) => {
                              // Prevent multiple downloads of the same segment
                              if (segmentDownloading[item.url]) {
                                console.log('🚫 MediaDownloader: Segment download already in progress for:', item.url);
                                return;
                              }

                              // Store the selected time range
                              setSelectedTimeRanges(prev => ({
                                ...prev,
                                [item.url]: { start: startTime, end: endTime }
                              }));

                              // Set downloading state
                              setSegmentDownloading(prev => ({ ...prev, [item.url]: true }));
                              setSegmentProgress(prev => ({ ...prev, [item.url]: 0 }));

                              // Trigger the download with the selected time range
                              try {
                                const quality = selectedQuality[item.url] || 'high';
                                // Notify user of selected quality and time range at start
                                const timeRangeText = `${formatTime(startTime)} - ${formatTime(endTime)}`;
                                toast({
                                  title: "Starting Download",
                                  description: `${item.filename} (${timeRangeText}) – Quality: ${quality}`,
                                });
                                await DownloadService.downloadMedia(item, quality, (progress) => {
                                  setSegmentProgress(prev => ({ ...prev, [item.url]: progress }));
                                }, startTime, endTime);

                                toast({
                                  title: "Download Complete",
                                  description: `${item.filename} (${timeRangeText}) has been downloaded successfully`,
                                });
                              } catch (error) {
                                console.error('Download failed:', error);
                                // Check if this is an AbortError (cancellation) or if download was already cancelled
                                if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('cancelled') || error.message.includes('aborted'))) {
                                  // Don't show toast for cancellation - it's already handled by onCancelDownload
                                  return;
                                }
                                // Only show error toast if the download is still marked as active
                                if (segmentDownloading[item.url]) {
                                  toast({
                                    title: "Download Failed",
                                    description: error instanceof Error ? error.message : "An error occurred during download",
                                    variant: "destructive",
                                  });
                                }
                              } finally {
                                // Reset downloading state
                                setSegmentDownloading(prev => ({ ...prev, [item.url]: false }));
                                setSegmentProgress(prev => ({ ...prev, [item.url]: 0 }));
                              }
                            }}
                            onCancel={() => {
                              setShowTimeSelector(prev => ({
                                ...prev,
                                [item.url]: false
                              }));
                              // Reset downloading state when canceling time selector
                              setSegmentDownloading(prev => ({ ...prev, [item.url]: false }));
                              setSegmentProgress(prev => ({ ...prev, [item.url]: 0 }));
                            }}
                            onCancelDownload={() => {
                              // Cancel the active download
                              DownloadService.cancelDownload(item.url);
                              setSegmentDownloading(prev => ({ ...prev, [item.url]: false }));
                              setSegmentProgress(prev => ({ ...prev, [item.url]: 0 }));
                              toast({
                                title: "Download Cancelled",
                                description: `Download of ${item.filename} segment has been cancelled`,
                              });
                            }}
                            inline={true}
                          />
                        </div>
                      ))
                    }
                  </div>
                </Card>
              ) : null;
            })()}
          </div>
        )}

        {/* Error State */}
        {!isAnalyzing && analysisError && (
          <Card className="p-12 text-center shadow-card bg-gradient-to-br from-destructive/5 to-destructive/10 backdrop-blur-sm border-destructive/20">
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-destructive/10 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">
                Analysis Failed
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {analysisError}
              </p>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAnalysisError(null);
                      handleAnalyze();
                    }}
                    className="text-xs"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUrl("");
                      setAnalysisError(null);
                      setHasAnalyzed(false);
                      setMediaItems([]);
                    }}
                    className="text-xs"
                  >
                    Clear URL
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isAnalyzing &&
          !analysisError &&
          mediaItems.length === 0 &&
          url &&
          hasAnalyzed && (
            <Card className="p-12 text-center shadow-card bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm border-border/50">
              <div className="max-w-md mx-auto">
                <div className="p-4 rounded-full bg-muted/20 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">
                  No Media Content Found
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  We couldn't detect any downloadable media on this page. This
                  could happen if:
                </p>
                <div className="text-left space-y-2 mb-6">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>
                      The page doesn't contain images, videos, or audio files
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>
                      Media content is protected or requires authentication
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>The website blocks automated media detection</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span>Media is loaded dynamically via JavaScript</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Try these suggestions:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUrl("");
                        setHasAnalyzed(false);
                        setMediaItems([]);
                        setAnalysisError(null);
                      }}
                      className="text-xs"
                    >
                      Try Different URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open("https://www.youtube.com", "_blank")
                      }
                      className="text-xs"
                    >
                      Test with YouTube
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open("https://unsplash.com", "_blank")
                      }
                      className="text-xs"
                    >
                      Test with Unsplash
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
      </div>
    </div>
  );
};
