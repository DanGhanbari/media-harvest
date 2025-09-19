import axios from 'axios';

class CaptchaSolvingService {
    constructor() {
        this.providers = {
            '2captcha': {
                apiKey: process.env.TWOCAPTCHA_API_KEY,
                baseUrl: 'http://2captcha.com',
                enabled: !!process.env.TWOCAPTCHA_API_KEY
            },
            'anticaptcha': {
                apiKey: process.env.ANTICAPTCHA_API_KEY,
                baseUrl: 'https://api.anti-captcha.com',
                enabled: !!process.env.ANTICAPTCHA_API_KEY
            },
            'capmonster': {
                apiKey: process.env.CAPMONSTER_API_KEY,
                baseUrl: 'https://api.capmonster.cloud',
                enabled: !!process.env.CAPMONSTER_API_KEY
            }
        };
        
        this.stats = {
            totalSolved: 0,
            totalFailed: 0,
            averageSolveTime: 0,
            providerStats: {}
        };
        
        this.maxRetries = 3;
        this.defaultTimeout = 120000; // 2 minutes
        
        // Initialize provider stats
        Object.keys(this.providers).forEach(provider => {
            this.stats.providerStats[provider] = {
                solved: 0,
                failed: 0,
                averageTime: 0,
                lastUsed: null
            };
        });
        
        console.log('🤖 CAPTCHA Solving Service initialized');
        this.printAvailableProviders();
    }

    printAvailableProviders() {
        const enabledProviders = Object.entries(this.providers)
            .filter(([, config]) => config.enabled)
            .map(([name]) => name);
            
        if (enabledProviders.length > 0) {
            console.log(`✅ Available CAPTCHA providers: ${enabledProviders.join(', ')}`);
        } else {
            console.log('⚠️ No CAPTCHA providers configured. Set API keys in environment variables:');
            console.log('   - TWOCAPTCHA_API_KEY for 2captcha.com');
            console.log('   - ANTICAPTCHA_API_KEY for anti-captcha.com');
            console.log('   - CAPMONSTER_API_KEY for capmonster.cloud');
        }
    }

    getAvailableProviders() {
        return Object.entries(this.providers)
            .filter(([, config]) => config.enabled)
            .map(([name]) => name);
    }

    async solveRecaptchaV2(siteKey, pageUrl, options = {}) {
        const {
            provider = 'auto',
            timeout = this.defaultTimeout,
            invisible = false,
            enterprise = false
        } = options;

        console.log(`🔍 Solving reCAPTCHA v2 for ${pageUrl}`);
        console.log(`   Site key: ${siteKey}`);
        console.log(`   Invisible: ${invisible}`);
        console.log(`   Enterprise: ${enterprise}`);

        const startTime = Date.now();
        
        try {
            let result;
            
            if (provider === 'auto') {
                result = await this.solveWithBestProvider('recaptcha_v2', {
                    siteKey,
                    pageUrl,
                    invisible,
                    enterprise,
                    timeout
                });
            } else {
                result = await this.solveWithProvider(provider, 'recaptcha_v2', {
                    siteKey,
                    pageUrl,
                    invisible,
                    enterprise,
                    timeout
                });
            }
            
            const solveTime = Date.now() - startTime;
            this.updateStats(true, solveTime, result.provider);
            
            console.log(`✅ reCAPTCHA v2 solved in ${solveTime}ms using ${result.provider}`);
            return result.solution;
            
        } catch (error) {
            const solveTime = Date.now() - startTime;
            this.updateStats(false, solveTime);
            
            console.log(`❌ Failed to solve reCAPTCHA v2: ${error.message}`);
            throw error;
        }
    }

    async solveRecaptchaV3(siteKey, pageUrl, action, options = {}) {
        const {
            provider = 'auto',
            timeout = this.defaultTimeout,
            minScore = 0.3
        } = options;

        console.log(`🔍 Solving reCAPTCHA v3 for ${pageUrl}`);
        console.log(`   Site key: ${siteKey}`);
        console.log(`   Action: ${action}`);
        console.log(`   Min score: ${minScore}`);

        const startTime = Date.now();
        
        try {
            let result;
            
            if (provider === 'auto') {
                result = await this.solveWithBestProvider('recaptcha_v3', {
                    siteKey,
                    pageUrl,
                    action,
                    minScore,
                    timeout
                });
            } else {
                result = await this.solveWithProvider(provider, 'recaptcha_v3', {
                    siteKey,
                    pageUrl,
                    action,
                    minScore,
                    timeout
                });
            }
            
            const solveTime = Date.now() - startTime;
            this.updateStats(true, solveTime, result.provider);
            
            console.log(`✅ reCAPTCHA v3 solved in ${solveTime}ms using ${result.provider}`);
            return result.solution;
            
        } catch (error) {
            const solveTime = Date.now() - startTime;
            this.updateStats(false, solveTime);
            
            console.log(`❌ Failed to solve reCAPTCHA v3: ${error.message}`);
            throw error;
        }
    }

    async solveFuncaptcha(publicKey, pageUrl, options = {}) {
        const {
            provider = 'auto',
            timeout = this.defaultTimeout
        } = options;

        console.log(`🔍 Solving FunCaptcha for ${pageUrl}`);
        console.log(`   Public key: ${publicKey}`);

        const startTime = Date.now();
        
        try {
            let result;
            
            if (provider === 'auto') {
                result = await this.solveWithBestProvider('funcaptcha', {
                    publicKey,
                    pageUrl,
                    timeout
                });
            } else {
                result = await this.solveWithProvider(provider, 'funcaptcha', {
                    publicKey,
                    pageUrl,
                    timeout
                });
            }
            
            const solveTime = Date.now() - startTime;
            this.updateStats(true, solveTime, result.provider);
            
            console.log(`✅ FunCaptcha solved in ${solveTime}ms using ${result.provider}`);
            return result.solution;
            
        } catch (error) {
            const solveTime = Date.now() - startTime;
            this.updateStats(false, solveTime);
            
            console.log(`❌ Failed to solve FunCaptcha: ${error.message}`);
            throw error;
        }
    }

    async solveWithBestProvider(captchaType, params) {
        const availableProviders = this.getAvailableProviders();
        
        if (availableProviders.length === 0) {
            throw new Error('No CAPTCHA providers available');
        }
        
        // Sort providers by success rate and average time
        const sortedProviders = availableProviders.sort((a, b) => {
            const statsA = this.stats.providerStats[a];
            const statsB = this.stats.providerStats[b];
            
            const successRateA = statsA.solved / Math.max(statsA.solved + statsA.failed, 1);
            const successRateB = statsB.solved / Math.max(statsB.solved + statsB.failed, 1);
            
            // Prefer higher success rate, then lower average time
            if (successRateA !== successRateB) {
                return successRateB - successRateA;
            }
            
            return statsA.averageTime - statsB.averageTime;
        });
        
        let lastError;
        
        for (const provider of sortedProviders) {
            try {
                console.log(`🔄 Trying provider: ${provider}`);
                const result = await this.solveWithProvider(provider, captchaType, params);
                return { ...result, provider };
            } catch (error) {
                console.log(`❌ Provider ${provider} failed: ${error.message}`);
                lastError = error;
                continue;
            }
        }
        
        throw lastError || new Error('All CAPTCHA providers failed');
    }

    async solveWithProvider(provider, captchaType, params) {
        const config = this.providers[provider];
        
        if (!config || !config.enabled) {
            throw new Error(`Provider ${provider} is not available`);
        }
        
        switch (provider) {
            case '2captcha':
                return await this.solveWith2Captcha(captchaType, params);
            case 'anticaptcha':
                return await this.solveWithAntiCaptcha(captchaType, params);
            case 'capmonster':
                return await this.solveWithCapMonster(captchaType, params);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    async solveWith2Captcha(captchaType, params) {
        const config = this.providers['2captcha'];
        const { timeout = this.defaultTimeout } = params;
        
        // Submit CAPTCHA
        const submitData = {
            key: config.apiKey,
            method: this.get2CaptchaMethod(captchaType),
            json: 1,
            ...this.format2CaptchaParams(captchaType, params)
        };
        
        const submitResponse = await axios.post(`${config.baseUrl}/in.php`, submitData);
        
        if (submitResponse.data.status !== 1) {
            throw new Error(`2captcha submit failed: ${submitResponse.data.error_text}`);
        }
        
        const captchaId = submitResponse.data.request;
        console.log(`📝 2captcha task submitted: ${captchaId}`);
        
        // Poll for result
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            await this.sleep(5000); // Wait 5 seconds
            
            const resultResponse = await axios.get(`${config.baseUrl}/res.php`, {
                params: {
                    key: config.apiKey,
                    action: 'get',
                    id: captchaId,
                    json: 1
                }
            });
            
            if (resultResponse.data.status === 1) {
                return { solution: resultResponse.data.request };
            }
            
            if (resultResponse.data.error_text && 
                resultResponse.data.error_text !== 'CAPCHA_NOT_READY') {
                throw new Error(`2captcha error: ${resultResponse.data.error_text}`);
            }
        }
        
        throw new Error('2captcha timeout');
    }

    async solveWithAntiCaptcha(captchaType, params) {
        const config = this.providers['anticaptcha'];
        const { timeout = this.defaultTimeout } = params;
        
        // Submit CAPTCHA
        const submitData = {
            clientKey: config.apiKey,
            task: this.formatAntiCaptchaTask(captchaType, params)
        };
        
        const submitResponse = await axios.post(`${config.baseUrl}/createTask`, submitData);
        
        if (submitResponse.data.errorId !== 0) {
            throw new Error(`AntiCaptcha submit failed: ${submitResponse.data.errorDescription}`);
        }
        
        const taskId = submitResponse.data.taskId;
        console.log(`📝 AntiCaptcha task submitted: ${taskId}`);
        
        // Poll for result
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            await this.sleep(5000); // Wait 5 seconds
            
            const resultResponse = await axios.post(`${config.baseUrl}/getTaskResult`, {
                clientKey: config.apiKey,
                taskId: taskId
            });
            
            if (resultResponse.data.errorId !== 0) {
                throw new Error(`AntiCaptcha error: ${resultResponse.data.errorDescription}`);
            }
            
            if (resultResponse.data.status === 'ready') {
                return { solution: resultResponse.data.solution.gRecaptchaResponse || resultResponse.data.solution.token };
            }
        }
        
        throw new Error('AntiCaptcha timeout');
    }

    async solveWithCapMonster(captchaType, params) {
        const config = this.providers['capmonster'];
        const { timeout = this.defaultTimeout } = params;
        
        // Submit CAPTCHA
        const submitData = {
            clientKey: config.apiKey,
            task: this.formatCapMonsterTask(captchaType, params)
        };
        
        const submitResponse = await axios.post(`${config.baseUrl}/createTask`, submitData);
        
        if (submitResponse.data.errorId !== 0) {
            throw new Error(`CapMonster submit failed: ${submitResponse.data.errorDescription}`);
        }
        
        const taskId = submitResponse.data.taskId;
        console.log(`📝 CapMonster task submitted: ${taskId}`);
        
        // Poll for result
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            await this.sleep(5000); // Wait 5 seconds
            
            const resultResponse = await axios.post(`${config.baseUrl}/getTaskResult`, {
                clientKey: config.apiKey,
                taskId: taskId
            });
            
            if (resultResponse.data.errorId !== 0) {
                throw new Error(`CapMonster error: ${resultResponse.data.errorDescription}`);
            }
            
            if (resultResponse.data.status === 'ready') {
                return { solution: resultResponse.data.solution.gRecaptchaResponse || resultResponse.data.solution.token };
            }
        }
        
        throw new Error('CapMonster timeout');
    }

    get2CaptchaMethod(captchaType) {
        switch (captchaType) {
            case 'recaptcha_v2': return 'userrecaptcha';
            case 'recaptcha_v3': return 'userrecaptcha';
            case 'funcaptcha': return 'funcaptcha';
            default: throw new Error(`Unsupported captcha type for 2captcha: ${captchaType}`);
        }
    }

    format2CaptchaParams(captchaType, params) {
        switch (captchaType) {
            case 'recaptcha_v2':
                return {
                    googlekey: params.siteKey,
                    pageurl: params.pageUrl,
                    invisible: params.invisible ? 1 : 0,
                    enterprise: params.enterprise ? 1 : 0
                };
            case 'recaptcha_v3':
                return {
                    googlekey: params.siteKey,
                    pageurl: params.pageUrl,
                    version: 'v3',
                    action: params.action,
                    min_score: params.minScore
                };
            case 'funcaptcha':
                return {
                    publickey: params.publicKey,
                    pageurl: params.pageUrl
                };
            default:
                throw new Error(`Unsupported captcha type: ${captchaType}`);
        }
    }

    formatAntiCaptchaTask(captchaType, params) {
        switch (captchaType) {
            case 'recaptcha_v2':
                return {
                    type: params.enterprise ? 'RecaptchaV2EnterpriseTaskProxyless' : 'RecaptchaV2TaskProxyless',
                    websiteURL: params.pageUrl,
                    websiteKey: params.siteKey,
                    isInvisible: params.invisible
                };
            case 'recaptcha_v3':
                return {
                    type: params.enterprise ? 'RecaptchaV3EnterpriseTaskProxyless' : 'RecaptchaV3TaskProxyless',
                    websiteURL: params.pageUrl,
                    websiteKey: params.siteKey,
                    pageAction: params.action,
                    minScore: params.minScore
                };
            case 'funcaptcha':
                return {
                    type: 'FunCaptchaTaskProxyless',
                    websiteURL: params.pageUrl,
                    websitePublicKey: params.publicKey
                };
            default:
                throw new Error(`Unsupported captcha type: ${captchaType}`);
        }
    }

    formatCapMonsterTask(captchaType, params) {
        switch (captchaType) {
            case 'recaptcha_v2':
                return {
                    type: 'NoCaptchaTaskProxyless',
                    websiteURL: params.pageUrl,
                    websiteKey: params.siteKey,
                    isInvisible: params.invisible
                };
            case 'recaptcha_v3':
                return {
                    type: 'RecaptchaV3TaskProxyless',
                    websiteURL: params.pageUrl,
                    websiteKey: params.siteKey,
                    pageAction: params.action,
                    minScore: params.minScore
                };
            case 'funcaptcha':
                return {
                    type: 'FunCaptchaTaskProxyless',
                    websiteURL: params.pageUrl,
                    websitePublicKey: params.publicKey
                };
            default:
                throw new Error(`Unsupported captcha type: ${captchaType}`);
        }
    }

    updateStats(success, solveTime, provider = null) {
        if (success) {
            this.stats.totalSolved++;
            this.stats.averageSolveTime = 
                (this.stats.averageSolveTime * (this.stats.totalSolved - 1) + solveTime) / this.stats.totalSolved;
        } else {
            this.stats.totalFailed++;
        }
        
        if (provider && this.stats.providerStats[provider]) {
            const providerStats = this.stats.providerStats[provider];
            
            if (success) {
                providerStats.solved++;
                providerStats.averageTime = 
                    (providerStats.averageTime * (providerStats.solved - 1) + solveTime) / providerStats.solved;
            } else {
                providerStats.failed++;
            }
            
            providerStats.lastUsed = Date.now();
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        const totalAttempts = this.stats.totalSolved + this.stats.totalFailed;
        
        return {
            ...this.stats,
            successRate: totalAttempts > 0 ? this.stats.totalSolved / totalAttempts : 0,
            totalAttempts
        };
    }

    printStats() {
        const stats = this.getStats();
        
        console.log('\n🤖 CAPTCHA Solving Statistics:');
        console.log(`  Total attempts: ${stats.totalAttempts}`);
        console.log(`  Solved: ${stats.totalSolved}`);
        console.log(`  Failed: ${stats.totalFailed}`);
        console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`  Average solve time: ${stats.averageSolveTime.toFixed(0)}ms`);
        
        console.log('\n📊 Provider Statistics:');
        Object.entries(stats.providerStats).forEach(([provider, providerStats]) => {
            const total = providerStats.solved + providerStats.failed;
            const successRate = total > 0 ? providerStats.solved / total : 0;
            
            console.log(`  ${provider}:`);
            console.log(`    Solved: ${providerStats.solved}`);
            console.log(`    Failed: ${providerStats.failed}`);
            console.log(`    Success rate: ${(successRate * 100).toFixed(1)}%`);
            console.log(`    Average time: ${providerStats.averageTime.toFixed(0)}ms`);
            console.log(`    Last used: ${providerStats.lastUsed ? new Date(providerStats.lastUsed).toISOString() : 'Never'}`);
        });
    }

    resetStats() {
        this.stats = {
            totalSolved: 0,
            totalFailed: 0,
            averageSolveTime: 0,
            providerStats: {}
        };
        
        Object.keys(this.providers).forEach(provider => {
            this.stats.providerStats[provider] = {
                solved: 0,
                failed: 0,
                averageTime: 0,
                lastUsed: null
            };
        });
        
        console.log('📊 CAPTCHA solving statistics reset');
    }
}

export default CaptchaSolvingService;