import axios from 'axios';

const testUrl = 'https://edv.travel/adherer/annuaire-des-adherents';

console.log('🔍 Testing connection to EDV Travel...');

// Test simple avec timeout très court
async function testConnection() {
  try {
    console.log('\n🔗 Testing with short timeout...');
    const response = await axios.get(testUrl, {
      timeout: 5000, // 5 secondes seulement
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    });
    console.log('✅ Connection successful:', response.status);
    console.log('📏 Content length:', response.data.length);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.code) console.error('� Error code:', error.code);
    return false;
  }
}

// Test avec native fetch
async function testFetch() {
  try {
    console.log('\n🌐 Testing with native fetch...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(testUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    console.log('✅ Fetch successful:', response.status);
    const text = await response.text();
    console.log('📏 Content length:', text.length);
    return true;
  } catch (error) {
    console.error('❌ Fetch failed:', error.message);
    return false;
  }
}

// Exécution séquentielle
const axiosResult = await testConnection();
if (!axiosResult) {
  await testFetch();
}

console.log('\n🔚 Connection test complete');
