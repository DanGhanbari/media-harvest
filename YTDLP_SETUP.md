# YouTube Download Setup with yt-dlp

This application now includes a powerful backend that uses `yt-dlp` for reliable YouTube video downloads.

## Prerequisites

### Install yt-dlp

You need to install `yt-dlp` on your system for the backend to work:

```bash
# Using pip (recommended)
pip install yt-dlp

# Or using pip3
pip3 install yt-dlp

# Or using homebrew on macOS
brew install yt-dlp
```

### Verify Installation

Check if yt-dlp is installed correctly:

```bash
yt-dlp --version
```

## Running the Application

### Full-Stack Mode (with yt-dlp backend)

```bash
# Install dependencies
npm install

# Build and start the full-stack application
npm run dev:full
```

The application will be available at: `http://localhost:3001`

### Development Mode (frontend only)

```bash
# For frontend development without backend
npm run dev
```

This runs only the frontend at: `http://localhost:8082`

## API Endpoints

When running in full-stack mode, the following API endpoints are available:

- `POST /api/download-youtube` - Download YouTube videos using yt-dlp
- `GET /api/health` - Check if yt-dlp is available

## How It Works

1. **Primary Method**: The application first tries to use the local yt-dlp backend for YouTube downloads
2. **Fallback Methods**: If yt-dlp is not available, it falls back to external APIs
3. **File Handling**: Videos are downloaded server-side and streamed to the browser for saving

## Benefits of yt-dlp Backend

- ✅ **Most Reliable**: yt-dlp is actively maintained and handles YouTube's anti-bot measures
- ✅ **High Quality**: Supports various video qualities and formats
- ✅ **Fast Downloads**: Direct downloads without external API limitations
- ✅ **Privacy**: No data sent to third-party services
- ✅ **Offline Capable**: Works without internet for the backend processing

## Troubleshooting

### yt-dlp Not Found

If you see "yt-dlp is not installed" error:

1. Install yt-dlp using one of the methods above
2. Restart the server: `npm run dev:full`
3. Check the health endpoint: `http://localhost:3001/api/health`

### Permission Issues

On some systems, you might need to use `sudo` for pip installation:

```bash
sudo pip install yt-dlp
```

### Python/pip Not Found

If pip is not available, install Python first:

- **macOS**: `brew install python`
- **Ubuntu/Debian**: `sudo apt update && sudo apt install python3 python3-pip`
- **Windows**: Download from [python.org](https://python.org)

## Alternative Installation Methods

### Using pipx (isolated installation)

```bash
# Install pipx first
pip install pipx

# Install yt-dlp with pipx
pipx install yt-dlp
```

### Using conda

```bash
conda install -c conda-forge yt-dlp
```

### Binary Download

Download the binary directly from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and add it to your PATH.