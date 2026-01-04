import { MediaDownloader } from '@/components/MediaDownloader';
import { Navigation } from '@/components/Navigation';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="container mx-auto px-2 py-4 md:px-4 md:py-8">
          <MediaDownloader />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
