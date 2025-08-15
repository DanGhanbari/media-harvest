import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Cookie, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { DownloadService } from '@/services/DownloadService';

interface CookieUploadProps {
  onSessionUpdate?: (sessionId: string | null) => void;
}

export const CookieUpload: React.FC<CookieUploadProps> = ({ onSessionUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(DownloadService.getSessionId());
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.txt')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a .txt file containing Instagram cookies.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const newSessionId = await DownloadService.uploadCookies(file);
      setSessionId(newSessionId);
      onSessionUpdate?.(newSessionId);
      
      toast({
        title: "Cookies Uploaded Successfully! 🍪",
        description: "You can now download Instagram content. Session expires in 1 hour.",
      });
    } catch (error) {
      console.error('Cookie upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload cookies",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleClearSession = () => {
    DownloadService.clearSession();
    setSessionId(null);
    onSessionUpdate?.(null);
    toast({
      title: "Session Cleared",
      description: "Instagram authentication session has been cleared.",
    });
  };

  return (
    <Card className="p-4 mb-4 border-orange-200 bg-orange-50">
      <div className="flex items-start gap-3">
        <Cookie className="h-5 w-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900 mb-2">
            Instagram Authentication
          </h3>
          
          {!sessionId ? (
            <>
              <p className="text-sm text-orange-700 mb-3">
                To download Instagram content in production, upload your Instagram cookies file.
              </p>
              
              <div className="flex items-center gap-2 mb-3">
                <Input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="flex-1"
                />
                <Button 
                  disabled={isUploading}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isUploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">How to get Instagram cookies:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Install a browser extension like "Get cookies.txt LOCALLY"</li>
                      <li>Go to Instagram.com and make sure you're logged in</li>
                      <li>Use the extension to export cookies as a .txt file</li>
                      <li>Upload the file here</li>
                    </ol>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">
                  Instagram authentication active
                </span>
              </div>
              
              <p className="text-xs text-orange-600 mb-3">
                Session ID: {sessionId.substring(0, 12)}...
              </p>
              
              <Button 
                onClick={handleClearSession}
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Clear Session
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};