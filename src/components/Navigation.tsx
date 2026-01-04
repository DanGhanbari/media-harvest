import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';


export const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-2 md:px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 shrink-0">
            <h1 className="text-lg md:text-xl font-bold truncate">Media Tools</h1>
          </div>

          <div className="flex items-center space-x-1 md:space-x-1 shrink-0">
            <Button
              variant={location.pathname === '/' ? 'default' : 'ghost'}
              asChild
              size="sm"
              className="px-2 md:px-3"
            >
              <Link to="/" className="flex items-center">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Downloader</span>
              </Link>
            </Button>

            <Button
              variant={location.pathname === '/convert' ? 'default' : 'ghost'}
              asChild
              size="sm"
              className="px-2 md:px-3"
            >
              <Link to="/convert" className="flex items-center">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Converter</span>
              </Link>
            </Button>


          </div>
        </div>
      </div>
    </nav>
  );
};