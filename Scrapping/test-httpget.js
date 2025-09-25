import https from 'https';

console.log('🔍 Testing httpGet function...');

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    console.log(`📡 Making request to: ${url}`);
    
    const options = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.get(url, options, (res) => {
      console.log(`📨 Response received: ${res.statusCode}`);
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📄 Data received: ${data.length} characters`);
        resolve(data);
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.setTimeout(10000);
  });
}

// Test
try {
  const html = await httpGet('https://edv.travel/adherer/annuaire-des-adherents');
  console.log('✅ Request successful!');
  console.log(`📏 HTML length: ${html.length}`);
  console.log(`🔍 Contains "adhérent": ${html.includes('adhérent')}`);
} catch (error) {
  console.error('❌ Request failed:', error.message);
}

console.log('🔚 Test complete');
