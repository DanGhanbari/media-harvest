# Media Tools

A powerful web application for downloading media content from websites and converting video files. Built with React, TypeScript, and Node.js.

## 🚀 Features

### Media Downloader (MediaHarvest)
- **Universal Media Extraction**: Extract and download images, videos, and audio files from any webpage
- **Platform Support**: Works with YouTube, Instagram, Facebook, Twitter, and other popular platforms
- **Quality Selection**: Choose from multiple quality options (Best Quality, High 1080p, Medium 720p, Low 480p, Audio Only)
- **Batch Downloads**: Download multiple media files simultaneously
- **Real-time Progress**: Live download progress tracking with WebSocket updates
- **Smart Detection**: Automatically detects and categorizes media content

### Video Converter
- **Format Conversion**: Convert videos between popular formats (MP4, AVI, MOV, MKV, WebM)
- **Quality Control**: Adjust video quality and resolution settings
- **Audio Channel Management**: Advanced audio channel selection and mapping
- **Batch Processing**: Convert multiple files efficiently
- **Progress Tracking**: Real-time conversion progress with detailed feedback

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS, Radix UI, shadcn/ui
- **Backend**: Node.js, Express
- **Media Processing**: yt-dlp, FFmpeg
- **Real-time Communication**: WebSockets
- **Deployment**: Railway, Vercel

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- yt-dlp (for media downloading)
- FFmpeg (for video conversion)

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd media-tools
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install yt-dlp** (for media downloading)
   ```bash
   # macOS
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo apt install yt-dlp
   
   # Windows
   # Download from https://github.com/yt-dlp/yt-dlp/releases
   ```

4. **Install FFmpeg** (for video conversion)
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

### Development

1. **Start the development server**
   ```bash
   npm start
   ```
   
   This will:
   - Build the frontend in development mode
   - Start the Node.js backend server
   - Open the application at `http://localhost:3001`

2. **Available Scripts**
   ```bash
   npm run dev          # Frontend development server only
   npm run dev:server   # Backend server only
   npm run build        # Production build
   npm run build:dev    # Development build
   npm run lint         # Run ESLint
   ```

## 🌐 Deployment

### Railway Deployment

1. **Prepare for deployment**
   ```bash
   npm run deploy:setup
   ```

2. **Build for production**
   ```bash
   npm run deploy:build
   ```

3. **Deploy to Railway**
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the configuration
   - The app will be available at your Railway domain

### Environment Variables

Create `.env.production` for production settings:

```env
PORT=3001
BACKEND_ONLY=false
RAILWAY_DEPLOYMENT_ID=your-deployment-id
```

## 📖 Usage

### Media Downloader

1. **Enter a URL**: Paste any webpage URL containing media content
2. **Analyze**: Click "Analyze Page" to detect available media
3. **Select Quality**: Choose your preferred download quality for videos
4. **Download**: Click download buttons for individual files or download all

### Video Converter

1. **Upload File**: Select a video file from your device
2. **Choose Format**: Select output format (MP4, AVI, MOV, etc.)
3. **Set Quality**: Choose quality and resolution settings
4. **Audio Channels**: Configure audio channel mapping if needed
5. **Convert**: Start the conversion process

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── MediaDownloader.tsx
│   ├── VideoConverter.tsx
│   ├── MediaGrid.tsx
│   ├── Navigation.tsx
│   └── Footer.tsx
├── pages/              # Page components
│   ├── Index.tsx
│   ├── VideoConverter.tsx
│   └── NotFound.tsx
├── services/           # Business logic
│   ├── DownloadService.ts
│   ├── MediaDetectionService.ts
│   ├── VideoConversionService.ts
│   └── MetaUpdateService.ts
├── config/             # Configuration
│   └── api.ts
├── hooks/              # Custom React hooks
└── lib/                # Utilities
```

## 🔧 API Endpoints

- `GET /api/version` - Get application version
- `GET /api/quality-options` - Get available quality options
- `POST /api/download-video` - Download video from URL
- `POST /api/convert-video` - Convert uploaded video
- `POST /api/cancel-download` - Cancel active download
- `GET /api/health` - Health check

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **yt-dlp not found**: Ensure yt-dlp is installed and in your PATH
2. **FFmpeg not found**: Install FFmpeg for video conversion features
3. **Port already in use**: Kill processes on port 3001 or change the port
4. **Download failures**: Check internet connection and URL validity

### Support

For issues and questions:
- Check the [troubleshooting guide](RAILWAY_TROUBLESHOOTING.md)
- Review [deployment documentation](VERCEL_RAILWAY_DEPLOYMENT.md)
- Open an issue on GitHub

---

**Media Tools v1.0.0** - Extract, download, and convert media with ease! 🎬📥
# Updated for GitHub auto-deploy
