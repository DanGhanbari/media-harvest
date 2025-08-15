import { VideoConverter } from '@/components/VideoConverter';
import { Navigation } from '@/components/Navigation';

const VideoConverterPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <VideoConverter />
      </div>
    </div>
  );
};

export default VideoConverterPage;