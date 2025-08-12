import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Download, Globe, Image, Video, Music, FileImage, Loader2, AlertCircle } from 'lucide-react';
import { MediaDetectionService, MediaItem } from '@/services/MediaDetectionService';
import { MediaGrid } from '@/components/MediaGrid';

export const MediaDownloader = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { toast } = useToast();

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

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const items = await MediaDetectionService.detectMedia(url);
      
      clearInterval(progressInterval);
      setProgress(100);
      setMediaItems(items);

      toast({
        title: "Analysis Complete",
        description: `Found ${items.length} media items`,
      });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Could not analyze the webpage. Please check the URL and try again.');
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the webpage. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <FileImage className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl gradient-primary shadow-glow">
              <Download className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MediaHarvest
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Extract and download all media content from any webpage, including images, videos, and audio files
          </p>
        </div>

        {/* URL Input */}
        <Card className="p-8 mb-8 shadow-card">
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
                    if (e.key === 'Enter' && url && !isAnalyzing) {
                      handleAnalyze();
                    }
                  }}
                  className="pl-12 h-14 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary transition-smooth"
                  disabled={isAnalyzing}
                />
              </div>
              <Button 
                onClick={handleAnalyze} 
                className="h-14 px-8 text-lg"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : 'Analyze'}
              </Button>
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

        {/* Results */}
        {mediaItems.length > 0 && (
          <div className="space-y-6">
            {/* Stats */}
            <Card className="p-6 shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Items', value: mediaItems.length, icon: <FileImage /> },
                  { label: 'Images', value: mediaItems.filter(item => item.type === 'image').length, icon: <Image /> },
                  { label: 'Videos', value: mediaItems.filter(item => item.type === 'video').length, icon: <Video /> },
                  { label: 'Audio', value: mediaItems.filter(item => item.type === 'audio').length, icon: <Music /> },
                ].map((stat, index) => (
                  <div key={index} className="text-center p-4 rounded-xl gradient-secondary">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-3">
                      {React.cloneElement(stat.icon, { className: "w-6 h-6 text-primary-foreground" })}
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Media Grid */}
            <MediaGrid items={mediaItems} />
          </div>
        )}

        {/* Error State */}
        {!isAnalyzing && analysisError && (
          <Card className="p-12 text-center shadow-card bg-gradient-to-br from-destructive/5 to-destructive/10 backdrop-blur-sm border-destructive/20">
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-destructive/10 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">Analysis Failed</h3>
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
                      setUrl('');
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
        {!isAnalyzing && !analysisError && mediaItems.length === 0 && url && hasAnalyzed && (
          <Card className="p-12 text-center shadow-card bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm border-border/50">
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-muted/20 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">No Media Content Found</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We couldn't detect any downloadable media on this page. This could happen if:
              </p>
              <div className="text-left space-y-2 mb-6">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                  <span>The page doesn't contain images, videos, or audio files</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                  <span>Media content is protected or requires authentication</span>
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
                <p className="text-sm font-medium text-foreground">Try these suggestions:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setUrl('');
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
                    onClick={() => window.open('https://www.youtube.com', '_blank')}
                    className="text-xs"
                  >
                    Test with YouTube
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open('https://unsplash.com', '_blank')}
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