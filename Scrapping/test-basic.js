// Test simple de connectivité HTTPS
import https from 'https';

console.log('🔍 Testing basic HTTPS connectivity...');

// Test avec Google (doit toujours marcher)
const testGoogle = () => {
  return new Promise((resolve, reject) => {
    console.log('\n1️⃣  Testing Google...');
    
    const req = https.get('https://www.google.com', {
      timeout: 5000
    }, (res) => {
      console.log('✅ Google accessible:', res.statusCode);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.error('❌ Google failed:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ Google timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

// Test avec EDV Travel
const testEDV = () => {
  return new Promise((resolve, reject) => {
    console.log('\n2️⃣  Testing EDV Travel...');
    
    const req = https.get('https://edv.travel', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      console.log('✅ EDV Travel accessible:', res.statusCode);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.error('❌ EDV Travel failed:', error.message);
      console.error('📋 Error code:', error.code);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ EDV Travel timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

// Exécution des tests
try {
  await testGoogle();
  await testEDV();
  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Some tests failed:', error.message);
}

console.log('\n🔚 Basic connectivity test complete');
