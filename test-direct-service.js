import AdvancedDownloadService from './src/services/AdvancedDownloadService.js';
import UserAgentRotationService from './src/services/UserAgentRotationService.js';
import ErrorHandlingService from './src/services/ErrorHandlingService.js';

async function testOptimizedService() {
    console.log('🚀 Testing optimized AdvancedDownloadService...');
    
    try {
        // Initialize minimal services
        const userAgentService = new UserAgentRotationService();
        const errorService = new ErrorHandlingService({ logLevel: 'error' });
        
        const downloadService = new AdvancedDownloadService({
            timeout: 15000,
            enableProxyRotation: false,
            enableCookieRotation: false,
            userAgentService,
            errorService
        });
        
        console.log('✅ Services initialized');
        
        // Test 1: Basic video info retrieval
        console.log('\n🔍 Test 1: Basic video info retrieval...');
        const startTime1 = Date.now();
        
        const videoInfo1 = await downloadService.getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        
        const duration1 = Date.now() - startTime1;
        console.log(`✅ Video info retrieved in ${duration1}ms`);
        console.log('📊 Video details:');
        console.log(`   Title: ${videoInfo1.title || 'N/A'}`);
        console.log(`   Duration: ${videoInfo1.duration || 'N/A'}`);
        console.log(`   Uploader: ${videoInfo1.uploader || 'N/A'}`);
        
        // Test 2: Cache hit test
        console.log('\n🔄 Test 2: Cache hit test...');
        const startTime2 = Date.now();
        
        const videoInfo2 = await downloadService.getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        
        const duration2 = Date.now() - startTime2;
        console.log(`⚡ Cached video info retrieved in ${duration2}ms`);
        
        // Test 3: Different video
        console.log('\n🎵 Test 3: Different video...');
        const startTime3 = Date.now();
        
        const videoInfo3 = await downloadService.getVideoInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
        
        const duration3 = Date.now() - startTime3;
        console.log(`✅ Second video info retrieved in ${duration3}ms`);
        console.log(`   Title: ${videoInfo3.title || 'N/A'}`);
        
        // Performance analysis
        console.log('\n📈 Performance Analysis:');
        console.log(`   First video (cold): ${duration1}ms`);
        console.log(`   Same video (cached): ${duration2}ms`);
        console.log(`   Different video: ${duration3}ms`);
        console.log(`   Average retrieval: ${((duration1 + duration3) / 2).toFixed(0)}ms`);
        console.log(`   Cache speedup: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%`);
        
        // Performance rating
        const avgTime = (duration1 + duration3) / 2;
        if (avgTime < 4000) {
            console.log('🎉 Performance is EXCELLENT (< 4 seconds)');
        } else if (avgTime < 6000) {
            console.log('✅ Performance is GOOD (4-6 seconds)');
        } else if (avgTime < 10000) {
            console.log('⚠️ Performance is MODERATE (6-10 seconds)');
        } else {
            console.log('❌ Performance is SLOW (> 10 seconds)');
        }
        
        // Cache effectiveness
        if (duration2 < 500) {
            console.log('🎯 Cache is working PERFECTLY (< 500ms)');
        } else if (duration2 < 1000) {
            console.log('✅ Cache is working WELL (< 1 second)');
        } else {
            console.log('⚠️ Cache might need optimization');
        }
        
        console.log('\n🎊 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Error type:', error.constructor.name);
        if (error.stack) {
            console.error('📋 Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
    } finally {
        console.log('✅ Test completed');
        process.exit(0);
    }
}

testOptimizedService().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});