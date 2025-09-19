import EnhancedYouTubeDownloader from './src/EnhancedYouTubeDownloader.js';

async function testMinimal() {
    console.log('🚀 Testing minimal video info retrieval...');
    
    const downloader = new EnhancedYouTubeDownloader({
        proxies: { enabled: false },
        cookies: { enabled: false },
        captcha: { enabled: false },
        health: { enabled: false }, // Disable health monitoring
        retry: { maxAttempts: 1 }, // Minimal retries
        download: { timeout: 15000 } // Short timeout
    });
    
    try {
        console.log('📋 Initializing downloader...');
        await downloader.initialize();
        console.log('✅ Initialization complete');
        
        console.log('🔍 Getting video info...');
        const startTime = Date.now();
        
        const videoInfo = await downloader.getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
            timeout: 15000 // 15 second timeout
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Video info retrieved in ${duration}ms`);
        console.log('📊 Video details:');
        console.log(`   Title: ${videoInfo.title || 'N/A'}`);
        console.log(`   Duration: ${videoInfo.duration || 'N/A'}`);
        console.log(`   Uploader: ${videoInfo.uploader || 'N/A'}`);
        
        if (duration < 5000) {
            console.log('🎉 Performance is GOOD (< 5 seconds)');
        } else if (duration < 10000) {
            console.log('⚠️ Performance is MODERATE (5-10 seconds)');
        } else {
            console.log('❌ Performance is SLOW (> 10 seconds)');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Error type:', error.constructor.name);
    } finally {
        console.log('🔄 Shutting down...');
        try {
            await downloader.shutdown();
            console.log('✅ Shutdown complete');
        } catch (shutdownError) {
            console.error('⚠️ Shutdown error:', shutdownError.message);
        }
        
        // Force exit to prevent hanging
        setTimeout(() => {
            console.log('🔚 Force exit');
            process.exit(0);
        }, 1000);
    }
}

testMinimal().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});