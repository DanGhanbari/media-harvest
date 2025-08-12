import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ExternalLink, Image, Video, Music, FileImage, Check, Loader2, Settings, X } from 'lucide-react';
import { MediaItem } from '@/services/MediaDetectionService';
import { DownloadService, QualityOption } from '@/services/DownloadService';

interface MediaGridProps {
  items: MediaItem[];
}

export const MediaGrid = ({ items }: MediaGridProps) => {
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set());
  const [downloadedItems, setDownloadedItems] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<Record<string, string>>({});
  const [showQualitySelector, setShowQualitySelector] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    // Load quality options on component mount
    DownloadService.getQualityOptions().then(setQualityOptions);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <FileImage className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'video': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'audio': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const isVideoItem = (item: MediaItem) => {
    return item.type === 'video' || 
           item.url.includes('youtube.com') || 
           item.url.includes('youtu.be') || 
           item.url.includes('vimeo.com');
  };

  const handleDownload = async (item: MediaItem) => {
    const itemId = item.url;
    
    if (downloadingItems.has(itemId) || downloadedItems.has(itemId)) {
      return;
    }

    setDownloadingItems(prev => new Set(prev).add(itemId));
    setDownloadProgress(prev => ({ ...prev, [itemId]: 0 }));

    try {
      const quality = selectedQuality[itemId] || 'high';
      
      // Use the download service with progress callback
      await DownloadService.downloadMedia(item, quality, (progress) => {
        setDownloadProgress(prev => ({ ...prev, [itemId]: progress }));
      });
      
      setDownloadProgress(prev => ({ ...prev, [itemId]: 100 }));
      
      setTimeout(() => {
        setDownloadingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        setDownloadedItems(prev => new Set(prev).add(itemId));
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[itemId];
          return newProgress;
        });
      }, 500);

      toast({
        title: "Download Complete",
        description: `${item.filename} has been downloaded successfully`,
      });
    } catch (error) {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[itemId];
        return newProgress;
      });

      // Check if it was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Download Cancelled",
          description: `Download of ${item.filename} was cancelled`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: `Could not download ${item.filename}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleCancelDownload = async (item: MediaItem) => {
    const itemId = item.url;
    await DownloadService.cancelDownload(itemId);
    
    setDownloadingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
    setDownloadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[itemId];
      return newProgress;
    });
  };

  const handleDownloadAll = async () => {
    const nonDownloadedItems = items.filter(item => 
      !downloadingItems.has(item.url) && !downloadedItems.has(item.url)
    );

    if (nonDownloadedItems.length === 0) {
      toast({
        title: "Nothing to Download",
        description: "All items have already been downloaded",
      });
      return;
    }

    toast({
      title: "Bulk Download Started",
      description: `Downloading ${nonDownloadedItems.length} items...`,
    });

    // Download items one by one to avoid overwhelming the browser
    for (const item of nonDownloadedItems) {
      await handleDownload(item);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  return (
    <div className="space-y-6">
      {/* Download All Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Media Content</h2>
        <Button
          onClick={handleDownloadAll}
          variant="hero"
          className="shadow-glow"
          disabled={items.length === 0}
        >
          <Download className="w-5 h-5" />
          Download All ({items.length})
        </Button>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 p-2">
        {items.map((item, index) => {
          const isDownloading = downloadingItems.has(item.url);
          const isDownloaded = downloadedItems.has(item.url);
          const progress = downloadProgress[item.url] || 0;

          return (
            <Card key={index} className="overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 group bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:scale-[1.03] transform hover:-translate-y-1 relative">
              {/* Media Preview */}
              <div className="aspect-video bg-gradient-to-br from-muted/20 to-muted/40 relative overflow-hidden group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-300">
                {item.type === 'image' && item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 group-hover:from-primary/20 group-hover:to-secondary/20 transition-all duration-300">
                      {React.cloneElement(getIcon(item.type), { 
                        className: "w-8 h-8 text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300" 
                      })}
                    </div>
                  )}
                
                {/* Type Badge */}
                <Badge className={`absolute top-3 left-3 ${getTypeColor(item.type)} shadow-lg backdrop-blur-sm border-0 font-medium`}>
                  {getIcon(item.type)}
                  {item.type}
                </Badge>

                {/* Size Badge */}
                {item.size && (
                  <Badge variant="secondary" className="absolute top-3 right-3 bg-black/50 text-white border-0">
                    {item.size}
                  </Badge>
                )}
              </div>

              {/* Content */}
              <div className="p-5 space-y-4 bg-gradient-to-b from-transparent to-card/50">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors duration-300" title={item.filename}>
                    {item.filename}
                  </h3>
                  {item.dimensions && (
                    <p className="text-sm text-muted-foreground/80 font-medium">
                       {item.dimensions}
                     </p>
                  )}
                  {item.size && (
                     <p className="text-xs text-muted-foreground/60">
                       {item.size}
                     </p>
                   )}
                </div>

                {/* Progress Bar */}
                {isDownloading && (
                  <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20 backdrop-blur-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                         Progress
                       </span>
                      <span className="text-foreground font-bold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 bg-muted/30" />
                  </div>
                )}

                {/* Quality Selector for Videos */}
                {isVideoItem(item) && showQualitySelector[item.url] && (
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
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading || isDownloaded}
                    variant={isDownloaded ? "secondary" : "default"}
                    size="sm"
                    className={`${isDownloading ? 'flex-1' : 'flex-1'} transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg font-semibold`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : isDownloaded ? (
                         <>
                           <Check className="w-4 h-4" />
                           Downloaded
                         </>
                       ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download
                        </>
                      )}
                  </Button>
                  
                  {/* Cancel Button - only show when downloading */}
                  {isDownloading && (
                    <Button
                      onClick={() => handleCancelDownload(item)}
                      variant="destructive"
                      size="sm"
                      className="transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                      title="Cancel Download"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {isVideoItem(item) && (
                    <Button
                      onClick={() => {
                        setShowQualitySelector(prev => ({
                          ...prev,
                          [item.url]: !prev[item.url]
                        }));
                      }}
                      variant="outline"
                      size="sm"
                      className="transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg hover:bg-primary/10 hover:border-primary/50"
                      title="Quality Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => window.open(item.url, '_blank')}
                    variant="outline"
                    size="sm"
                    className="transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg hover:bg-secondary/10 hover:border-secondary/50"
                    title="Open Original"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};