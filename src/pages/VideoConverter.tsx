import { VideoConverter } from '@/components/VideoConverter';
import { Navigation } from '@/components/Navigation';
import Footer from '@/components/Footer';

const VideoConverterPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <VideoConverter />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VideoConverterPage;