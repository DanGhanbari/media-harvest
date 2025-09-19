const AdvancedDownloadService = require('./AdvancedDownloadService');
const fs = require('fs');
const path = require('path');

class EnhancedServerIntegration {
    constructor(app, wsConnections) {
        this.app = app;
        this.wsConnections = wsConnections;
        this.downloadService = new AdvancedDownloadService();
        this.activeDownloads = new Map();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Replace existing download endpoints
        this.setupEnhancedEndpoints();
        
        console.log('🚀 Enhanced Server Integration initialized');
    }

    setupEventListeners() {
        // Listen to download service events
        this.downloadService.on('downloadProgress', (data) => {
            this.broadcastProgress(data.taskId, data.progress);
        });

        this.downloadService.on('downloadComplete', (data) => {
            this.broadcastComplete(data.task.id, data.result);
        });

        this.downloadService.on('downloadFailed', (data) => {
            this.broadcastError(data.task.id, data.error);
        });

        this.downloadService.on('downloadRetry', (data) => {
            this.broadcastRetry(data.task.id, data.attempt, data.delay);
        });
    }

    setupEnhancedEndpoints() {
        // Enhanced video download endpoint
        this.app.post('/api/download-video-enhanced', async (req, res) => {
            await this.handleEnhancedDownload(req, res);
        });

        // Download status endpoint
        this.app.get('/api/download-status/:downloadId', async (req, res) => {
            await this.handleDownloadStatus(req, res);
        });

        // Cancel download endpoint
        this.app.delete('/api/download/:downloadId', async (req, res) => {
            await this.handleCancelDownload(req, res);
        });

        // Download queue status
        this.app.get('/api/download-queue', async (req, res) => {
            await this.handleQueueStatus(req, res);
        });

        // Service statistics
        this.app.get('/api/download-stats', async (req, res) => {
            await this.handleServiceStats(req, res);
        });

        // Reset statistics
        this.app.post('/api/download-stats/reset', async (req, res) => {
            await this.handleResetStats(req, res);
        });

        // Bulk download endpoint
        this.app.post('/api/download-bulk', async (req, res) => {
            await this.handleBulkDownload(req, res);
        });
    }

    async handleEnhancedDownload(req, res) {
        const { 
            url, 
            filename, 
            quality = 'best[height<=1080]', 
            sessionId, 
            startTime, 
            endTime,
            priority = 'normal',
            format = 'mp4',
            subtitles = false,
            thumbnail = false,
            metadata = false
        } = req.body;

        console.log('🎬 Enhanced download request:', { url, quality, priority, sessionId });

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        try {
            // Prepare download options
            const downloadOptions = {
                quality,
                format,
                priority,
                subtitles,
                thumbnail,
                metadata,
                outputPath: './downloads',
                sessionId,
                startTime,
                endTime,
                retries: 5
            };

            // Start the download
            const downloadId = await this.downloadService.downloadVideo(url, downloadOptions);
            
            // Store session mapping
            if (sessionId) {
                this.activeDownloads.set(downloadId, { sessionId, url, startedAt: Date.now() });
            }

            // Send immediate response with download ID
            res.json({
                success: true,
                downloadId,
                message: 'Download queued successfully',
                estimatedTime: '2-5 minutes',
                queuePosition: this.downloadService.downloadQueue.length + 1
            });

            // Send initial WebSocket notification
            if (sessionId && this.wsConnections.has(sessionId)) {
                const ws = this.wsConnections.get(sessionId);
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(JSON.stringify({
                        type: 'download_queued',
                        downloadId,
                        url,
                        quality,
                        priority
                    }));
                }
            }

        } catch (error) {
            console.error('Enhanced download error:', error);
            res.status(500).json({
                error: 'Failed to queue download',
                details: error.message
            });
        }
    }

    async handleDownloadStatus(req, res) {
        const { downloadId } = req.params;
        
        try {
            const status = this.downloadService.getDownloadStatus(downloadId);
            
            if (!status) {
                return res.status(404).json({ error: 'Download not found' });
            }

            res.json({
                downloadId,
                status: status.status,
                progress: status.progress || null,
                attempts: status.attempts || 0,
                errors: status.errors || [],
                createdAt: status.createdAt,
                startedAt: status.startedAt || null,
                completedAt: status.completedAt || null,
                result: status.result || null
            });

        } catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({
                error: 'Failed to get download status',
                details: error.message
            });
        }
    }

    async handleCancelDownload(req, res) {
        const { downloadId } = req.params;
        
        try {
            const cancelled = this.downloadService.cancelDownload(downloadId);
            
            if (cancelled) {
                // Clean up session mapping
                this.activeDownloads.delete(downloadId);
                
                res.json({
                    success: true,
                    message: 'Download cancelled successfully'
                });
            } else {
                res.status(404).json({
                    error: 'Download not found or cannot be cancelled'
                });
            }

        } catch (error) {
            console.error('Cancel download error:', error);
            res.status(500).json({
                error: 'Failed to cancel download',
                details: error.message
            });
        }
    }

    async handleQueueStatus(req, res) {
        try {
            const stats = this.downloadService.getStats();
            
            res.json({
                queueLength: stats.queueLength,
                activeDownloads: stats.activeDownloads,
                totalDownloads: stats.totalDownloads,
                successfulDownloads: stats.successfulDownloads,
                failedDownloads: stats.failedDownloads,
                successRate: stats.successRate,
                averageTime: stats.averageTime,
                queue: this.downloadService.downloadQueue.map(task => ({
                    id: task.id,
                    url: task.url,
                    status: task.status,
                    priority: task.options.priority,
                    createdAt: task.createdAt
                })),
                active: Array.from(this.downloadService.activeDownloads.values()).map(task => ({
                    id: task.id,
                    url: task.url,
                    status: task.status,
                    attempts: task.attempts,
                    startedAt: task.startedAt
                }))
            });

        } catch (error) {
            console.error('Queue status error:', error);
            res.status(500).json({
                error: 'Failed to get queue status',
                details: error.message
            });
        }
    }

    async handleServiceStats(req, res) {
        try {
            const stats = this.downloadService.getStats();
            
            res.json({
                overview: {
                    totalDownloads: stats.totalDownloads,
                    successfulDownloads: stats.successfulDownloads,
                    failedDownloads: stats.failedDownloads,
                    successRate: (stats.successRate * 100).toFixed(1) + '%',
                    averageTime: (stats.averageTime / 1000).toFixed(1) + 's',
                    averageSpeed: (stats.averageSpeed / 1024 / 1024).toFixed(2) + ' MB/s'
                },
                queue: {
                    length: stats.queueLength,
                    activeDownloads: stats.activeDownloads
                },
                services: stats.services,
                errorPatterns: Object.fromEntries(stats.errorPatterns),
                recommendations: this.generateRecommendations(stats)
            });

        } catch (error) {
            console.error('Service stats error:', error);
            res.status(500).json({
                error: 'Failed to get service statistics',
                details: error.message
            });
        }
    }

    async handleResetStats(req, res) {
        try {
            this.downloadService.resetStats();
            
            res.json({
                success: true,
                message: 'Statistics reset successfully'
            });

        } catch (error) {
            console.error('Reset stats error:', error);
            res.status(500).json({
                error: 'Failed to reset statistics',
                details: error.message
            });
        }
    }

    async handleBulkDownload(req, res) {
        const { urls, options = {} } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        if (urls.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 URLs allowed per bulk request' });
        }

        try {
            const downloadIds = [];
            
            for (const url of urls) {
                const downloadId = await this.downloadService.downloadVideo(url, {
                    ...options,
                    priority: 'normal' // Bulk downloads use normal priority
                });
                downloadIds.push({ url, downloadId });
            }

            res.json({
                success: true,
                message: `${urls.length} downloads queued successfully`,
                downloads: downloadIds,
                estimatedTime: `${urls.length * 3}-${urls.length * 8} minutes`
            });

        } catch (error) {
            console.error('Bulk download error:', error);
            res.status(500).json({
                error: 'Failed to queue bulk downloads',
                details: error.message
            });
        }
    }

    broadcastProgress(downloadId, progress) {
        const downloadInfo = this.activeDownloads.get(downloadId);
        if (!downloadInfo || !downloadInfo.sessionId) return;

        const ws = this.wsConnections.get(downloadInfo.sessionId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'download_progress',
                downloadId,
                progress: {
                    percentage: progress.percentage,
                    speed: progress.speed,
                    timestamp: progress.timestamp
                }
            }));
        }
    }

    broadcastComplete(downloadId, result) {
        const downloadInfo = this.activeDownloads.get(downloadId);
        if (!downloadInfo || !downloadInfo.sessionId) return;

        const ws = this.wsConnections.get(downloadInfo.sessionId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'download_complete',
                downloadId,
                duration: result.duration,
                success: true
            }));
        }

        // Clean up
        this.activeDownloads.delete(downloadId);
    }

    broadcastError(downloadId, error) {
        const downloadInfo = this.activeDownloads.get(downloadId);
        if (!downloadInfo || !downloadInfo.sessionId) return;

        const ws = this.wsConnections.get(downloadInfo.sessionId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'download_error',
                downloadId,
                error: error.message,
                success: false
            }));
        }

        // Clean up
        this.activeDownloads.delete(downloadId);
    }

    broadcastRetry(downloadId, attempt, delay) {
        const downloadInfo = this.activeDownloads.get(downloadId);
        if (!downloadInfo || !downloadInfo.sessionId) return;

        const ws = this.wsConnections.get(downloadInfo.sessionId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'download_retry',
                downloadId,
                attempt,
                delay,
                message: `Retrying download (attempt ${attempt}) in ${delay}ms`
            }));
        }
    }

    generateRecommendations(stats) {
        const recommendations = [];

        if (stats.successRate < 0.7) {
            recommendations.push({
                type: 'warning',
                message: 'Low success rate detected. Consider checking proxy and cookie configurations.'
            });
        }

        if (stats.services.proxy && stats.services.proxy.successRate < 0.5) {
            recommendations.push({
                type: 'error',
                message: 'Proxy service has low success rate. Consider updating proxy list.'
            });
        }

        if (stats.services.cookies && stats.services.cookies.successRate < 0.6) {
            recommendations.push({
                type: 'warning',
                message: 'Cookie authentication has low success rate. Consider refreshing cookies.'
            });
        }

        if (stats.queueLength > 10) {
            recommendations.push({
                type: 'info',
                message: 'Large queue detected. Consider increasing concurrent download limit.'
            });
        }

        if (stats.averageTime > 300000) { // 5 minutes
            recommendations.push({
                type: 'warning',
                message: 'Downloads taking longer than expected. Check network and service health.'
            });
        }

        return recommendations;
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down Enhanced Server Integration...');
        
        // Cancel all active downloads
        for (const downloadId of this.activeDownloads.keys()) {
            this.downloadService.cancelDownload(downloadId);
        }
        
        // Clear mappings
        this.activeDownloads.clear();
        
        console.log('✅ Enhanced Server Integration shutdown complete');
    }
}

module.exports = EnhancedServerIntegration;