// scratch/check-auth.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Verificando autenticación con cookies...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const cookiesPath = path.join(__dirname, '../src/modules/tiktok-trends/scraper/cookies.json');
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await context.addCookies(cookies);
    console.log('Cookies inyectadas.');
  } else {
    console.log('No se encontró cookies.json');
  }

  const page = await context.newPage();
  
  // Vamos a la URL de trends
  console.log('Navegando a trends...');
  await page.goto('https://ads.tiktok.com/creative/creativeCenter/trends?region=CO&period=7', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  
  console.log('URL final:', page.url());
  console.log('Título:', await page.title());
  
  const bodyText = await page.innerText('body');
  const loggedIn = !bodyText.includes('Log in');
  console.log('¿Logueado exitosamente?:', loggedIn ? 'SÍ' : 'NO (Aparece botón Log in)');

  console.log('--- Muestra de Texto del Body ---');
  console.log(bodyText.substring(0, 1500));
  console.log('---------------------------------');

  // Buscar si hay hashtags en el texto
  const foundHashtags = bodyText.match(/#[a-zA-Z0-9_]+/g) || [];
  console.log('Hashtags con # encontrados:', foundHashtags.length);
  if (foundHashtags.length > 0) {
    console.log('Primeros 10 hashtags con #:', foundHashtags.slice(0, 10));
  }
  
  // Buscar palabras clave como "views", "posts", "analytics", "ranking"
  console.log('¿Contiene "views"?:', bodyText.toLowerCase().includes('views'));
  console.log('¿Contiene "posts"?:', bodyText.toLowerCase().includes('posts'));
  console.log('¿Contiene "trending"?:', bodyText.toLowerCase().includes('trending'));
  console.log('¿Contiene "100K"?:', bodyText.toLowerCase().includes('100k') || bodyText.toLowerCase().includes('m'));

  const elementsInfo = await page.evaluate(() => {
    // Buscar elementos que contienen el caracter '#' (hashtags)
    const elements = Array.from(document.querySelectorAll('*'));
    const hashtagElements = [];
    
    elements.forEach(el => {
      if (el.children.length === 0 && el.innerText && el.innerText.startsWith('#')) {
        // Encontramos el elemento texto del hashtag
        // Subimos al contenedor padre de la fila
        let parent = el.parentElement;
        // Subir hasta 5 niveles para encontrar el contenedor de la fila de ranking
        let rowContainer = null;
        for (let i = 0; i < 5; i++) {
          if (parent && (parent.innerText.includes('See analytics') || parent.innerText.includes('analytics'))) {
            rowContainer = parent;
            break;
          }
          if (parent) parent = parent.parentElement;
        }
        
        hashtagElements.push({
          tag: el.tagName,
          className: el.className,
          text: el.innerText,
          parentTag: el.parentElement?.tagName,
          parentClass: el.parentElement?.className,
          rowContainerTag: rowContainer?.tagName,
          rowContainerClass: rowContainer?.className,
          rowContainerHTML: rowContainer?.outerHTML?.substring(0, 800) || ''
        });
      }
    });
    
    return hashtagElements;
  });

  console.log('--- ELEMENTOS HASHTAG ENCONTRADOS Y SUS FILAS ---');
  elementsInfo.slice(0, 3).forEach((el, idx) => {
    console.log(`\nHashtag ${idx + 1}: ${el.text}`);
    console.log(`Tag: ${el.tag}, Class: ${el.className}`);
    console.log(`Parent Tag: ${el.parentTag}, Parent Class: ${el.parentClass}`);
    console.log(`Row Container Tag: ${el.rowContainerTag}, Row Class: ${el.rowContainerClass}`);
    console.log(`Row Container HTML:\n${el.rowContainerHTML}\n`);
  });
  console.log('------------------------------------------------');

  await browser.close();
})();
