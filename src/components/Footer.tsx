import React from 'react';
import { Github } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const version = '1.0.0'; // This should match package.json version

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Left side - App info */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground">Media Tools</span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              v{version}
            </span>
          </div>

          {/* Right side - Links and copyright */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3 w-3" />
                <span>GitHub</span>
              </a>
            </div>
            <div className="text-xs text-muted-foreground">
              © {currentYear} Media Tools. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;