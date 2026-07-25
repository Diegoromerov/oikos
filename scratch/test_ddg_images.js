// backend/scratch/test_ddg_images.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function searchDDGImages(query) {
  try {
    // Step 1: Get vqd token
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    const vqdRegex = /vqd=([^&'"]+)/;
    const match = html.match(vqdRegex);
    
    // Fallback search in script
    let vqd = null;
    if (match) {
      vqd = match[1];
    } else {
      const vqdRegex2 = /vqd\s*=\s*['"]([^'"]+)['"]/;
      const match2 = html.match(vqdRegex2);
      if (match2) vqd = match2[1];
    }

    if (!vqd) {
      console.error('Failed to get VQD token from DuckDuckGo.');
      return;
    }
    
    console.log('Successfully extracted VQD:', vqd);

    // Step 2: Fetch image results
    const searchUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&vqd=${vqd}&f=,,,`;
    const imageResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://duckduckgo.com/'
      }
    });

    if (!imageResponse.ok) {
      console.error('DDG image API returned:', imageResponse.status);
      return;
    }

    const data = await imageResponse.json();
    console.log('Results keys:', Object.keys(data));
    if (data.results) {
      console.log(`Found ${data.results.length} images!`);
      const formatted = data.results.slice(0, 6).map(item => ({
        title: item.title,
        image_url: item.image,
        link: item.url
      }));
      console.log('First 6 results:');
      console.log(formatted);
    } else {
      console.log('No results field found in JSON response.');
    }

  } catch (error) {
    console.error('Error during DDG search:', error);
  }
}

searchDDGImages('uñas rojas site:pinterest.com');
