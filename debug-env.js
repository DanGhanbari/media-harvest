// Debug environment variables during build
console.log('Environment variables during build:');
console.log('VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All VITE_ vars:', Object.keys(process.env).filter(key => key.startsWith('VITE_')).map(key => `${key}: ${process.env[key]}`));