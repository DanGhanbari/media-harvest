import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Server, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

interface ServerHealth {
  status: string;
  ytDlpAvailable: boolean;
  message: string;
}

export const ServerStatus = () => {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkServerHealth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH);
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
        setLastChecked(new Date());
      } else {
        setHealth(null);
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkServerHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getServerType = () => {
    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
      return 'Local';
    } else if (API_BASE_URL.includes('onrender.com')) {
      return 'Render';
    } else if (API_BASE_URL.includes('railway.app')) {
      return 'Railway';
    } else if (API_BASE_URL.includes('vercel.app')) {
      return 'Vercel';
    } else if (API_BASE_URL === window.location.origin) {
      return 'Same Origin';
    } else {
      return 'Remote';
    }
  };

  const getStatusVariant = () => {
    if (!health) return 'destructive';
    if (health.status === 'ok' && health.ytDlpAvailable) return 'default';
    if (health.status === 'ok') return 'secondary';
    return 'destructive';
  };

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-3 w-3 animate-spin" />;
    if (!health) return <WifiOff className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (!health) return 'Offline';
    if (health.status === 'ok' && health.ytDlpAvailable) return 'Online';
    if (health.status === 'ok') return 'Limited';
    return 'Error';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Server className="h-4 w-4 mr-1" />
          <Badge variant={getStatusVariant()} className="text-xs">
            {getStatusIcon()}
            <span className="ml-1">{getServerType()}</span>
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Server Status</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkServerHealth}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Backend URL:</span>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {API_BASE_URL}
              </code>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Server Type:</span>
              <Badge variant="outline" className="text-xs">
                {getServerType()}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant={getStatusVariant()} className="text-xs">
                {getStatusIcon()}
                <span className="ml-1">{getStatusText()}</span>
              </Badge>
            </div>
            
            {health && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">yt-dlp:</span>
                  <Badge 
                    variant={health.ytDlpAvailable ? 'default' : 'destructive'} 
                    className="text-xs"
                  >
                    {health.ytDlpAvailable ? 'Available' : 'Missing'}
                  </Badge>
                </div>
                
                {health.message && (
                  <div className="text-xs text-muted-foreground">
                    {health.message}
                  </div>
                )}
              </>
            )}
            
            {lastChecked && (
              <div className="text-xs text-muted-foreground">
                Last checked: {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};