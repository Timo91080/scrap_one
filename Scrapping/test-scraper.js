console.log('🔍 Testing fixed scraper...');
console.log('📦 Importing scraper functions...');

try {
  const { fetchListLinks, scrapeDetail } = await import('./src/scraper.js');
  console.log('✅ Import successful');

  console.log('\n1️⃣  Testing fetchListLinks...');
  const links = await fetchListLinks();
  console.log(`✅ Found ${links.length} company links`);
  
  if (links.length > 0) {
    console.log(`📋 First few links:`);
    links.slice(0, 3).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link}`);
    });
    
    console.log('\n2️⃣  Testing scrapeDetail on first link...');
    const details = await scrapeDetail(links[0]);
    console.log('✅ Company details scraped:');
    console.log(JSON.stringify(details, null, 2));
  } else {
    console.log('⚠️  No links found to test scrapeDetail');
  }
  
} catch (error) {
  console.error('❌ Scraper test failed:', error.message);
  console.error('📋 Error details:', error);
}

console.log('\n🔚 Scraper test complete');