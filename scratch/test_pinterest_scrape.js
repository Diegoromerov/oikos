// backend/scratch/test_pinterest_scrape.js
const fs = require('fs');
const path = require('path');

function findPinimgInScripts() {
  try {
    const htmlPath = path.join(__dirname, 'pinterest_response.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    console.log(`Searching across ${scripts.length} script tags...`);
    
    scripts.forEach((s, idx) => {
      if (s.includes('pinimg.com')) {
        console.log(`👉 Script ${idx} contains pinimg.com! Size: ${s.length}`);
        console.log(s.substring(0, 300).replace(/\n/g, ''));
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

findPinimgInScripts();
