import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { ServerStatus } from './ServerStatus';

export const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold">Media Tools</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={location.pathname === '/' ? 'default' : 'ghost'}
              asChild
              size="sm"
            >
              <Link to="/" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Downloader</span>
              </Link>
            </Button>
            
            <Button
              variant={location.pathname === '/convert' ? 'default' : 'ghost'}
              asChild
              size="sm"
            >
              <Link to="/convert" className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Converter</span>
              </Link>
            </Button>
            
            <ServerStatus />
          </div>
        </div>
      </div>
    </nav>
  );
};