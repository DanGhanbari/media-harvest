import AdvancedDownloadService from './src/services/AdvancedDownloadService.js';
import UserAgentRotationService from './src/services/UserAgentRotationService.js';
import ErrorHandlingService from './src/services/ErrorHandlingService.js';
import path from 'path';
import { promises as fs } from 'fs';

async function testDownload() {
    console.log('🚀 Testing download functionality...');
    
    try {
        // Initialize services
        const userAgentService = new UserAgentRotationService();
        const errorService = new ErrorHandlingService({ logLevel: 'info' });
        
        const downloadService = new AdvancedDownloadService({
            timeout: 30000,
            enableProxyRotation: false,
            enableCookieRotation: false,
            userAgentService,
            errorService
        });
        
        console.log('✅ Services initialized');
        
        // Create test downloads directory
        const downloadDir = './test-downloads';
        await fs.mkdir(downloadDir, { recursive: true });
        console.log(`📁 Created download directory: ${downloadDir}`);
        
        // Test 1: Short video download
        console.log('\n🎬 Test 1: Downloading short video...');
        const startTime1 = Date.now();
        
        const downloadId1 = await downloadService.downloadVideo(
            'https://www.youtube.com/watch?v=jNQXAC9IVRw', // "Me at the zoo" - first YouTube video, very short
            {
                quality: 'worst[height<=480]', // Low quality for faster download
                outputPath: downloadDir,
                priority: 'high'
            }
        );
        
        console.log(`📥 Download queued with ID: ${downloadId1}`);
        
        // Monitor download progress
        let downloadComplete = false;
        const checkInterval = setInterval(() => {
            const status = downloadService.getDownloadStatus(downloadId1);
            if (status) {
                console.log(`📊 Status: ${status.status} (Attempt: ${status.attempts})`);
                
                if (status.status === 'completed') {
                    const duration1 = Date.now() - startTime1;
                    console.log(`✅ Download completed in ${(duration1 / 1000).toFixed(1)}s`);
                    downloadComplete = true;
                    clearInterval(checkInterval);
                } else if (status.status === 'failed') {
                    console.log(`❌ Download failed: ${status.error}`);
                    downloadComplete = true;
                    clearInterval(checkInterval);
                }
            }
        }, 2000);
        
        // Wait for download to complete (max 2 minutes)
        const maxWaitTime = 120000;
        const waitStart = Date.now();
        
        while (!downloadComplete && (Date.now() - waitStart) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        clearInterval(checkInterval);
        
        if (!downloadComplete) {
            console.log('⏰ Download timeout - cancelling...');
            downloadService.cancelDownload(downloadId1);
        }
        
        // Check if file was created
        try {
            const files = await fs.readdir(downloadDir);
            console.log(`📁 Files in download directory: ${files.length}`);
            if (files.length > 0) {
                console.log(`   Files: ${files.join(', ')}`);
                
                // Get file stats
                for (const file of files) {
                    const filePath = path.join(downloadDir, file);
                    const stats = await fs.stat(filePath);
                    console.log(`   ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        } catch (error) {
            console.log(`❌ Error reading download directory: ${error.message}`);
        }
        
        // Get final download status
        const finalStatus = downloadService.getDownloadStatus(downloadId1);
        if (finalStatus) {
            console.log('\n📊 Final Download Status:');
            console.log(`   Status: ${finalStatus.status}`);
            console.log(`   Attempts: ${finalStatus.attempts}`);
            if (finalStatus.error) {
                console.log(`   Error: ${finalStatus.error}`);
            }
            if (finalStatus.result) {
                console.log(`   Duration: ${(finalStatus.result.duration / 1000).toFixed(1)}s`);
            }
        }
        
        // Get service stats
        console.log('\n📈 Service Statistics:');
        const stats = downloadService.getStats();
        console.log(`   Total downloads: ${stats.totalDownloads}`);
        console.log(`   Successful: ${stats.successfulDownloads}`);
        console.log(`   Failed: ${stats.failedDownloads}`);
        console.log(`   Success rate: ${((stats.successfulDownloads / stats.totalDownloads) * 100).toFixed(1)}%`);
        
        if (stats.successfulDownloads > 0) {
            console.log('🎉 Download test PASSED!');
        } else {
            console.log('❌ Download test FAILED - no successful downloads');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Error type:', error.constructor.name);
        if (error.stack) {
            console.error('📋 Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
    } finally {
        console.log('\n✅ Test completed');
        process.exit(0);
    }
}

testDownload().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});