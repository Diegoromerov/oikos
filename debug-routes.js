// debug-routes.js - Diagnóstico completo del router de TikTok Trends
console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO DEL ROUTER TIKTOK TRENDS');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  // 1. Cargar el módulo
  console.log('📦 Paso 1: Cargando módulo tiktok-trends...');
  const tiktokTrendsModule = require('./src/modules/tiktok-trends');
  
  console.log(`   - initialize: ${typeof tiktokTrendsModule.initialize}`);
  console.log(`   - isEnabled: ${typeof tiktokTrendsModule.isEnabled}`);
  console.log(`   - router: ${typeof tiktokTrendsModule.router}`);
  console.log(`   - router.stack: ${tiktokTrendsModule.router?.stack ? 'EXISTS' : 'MISSING'}\n`);

  // 2. Cargar directamente el router
  console.log('🛣️  Paso 2: Cargando router directamente...');
  const router = require('./src/modules/tiktok-trends/routes/tiktokTrends.routes');
  console.log(`   - router type: ${typeof router}`);
  console.log(`   - router.stack length: ${router?.stack?.length || 0}\n`);

  // 3. Listar rutas
  if (router && router.stack) {
    console.log('📋 Paso 3: Rutas registradas en el router:\n');
    
    let routeCount = 0;
    router.stack.forEach((layer, idx) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        console.log(`   ${++routeCount}. ${methods} ${layer.route.path}`);
      }
    });
    
    if (routeCount === 0) {
      console.log('   ⚠️  NO HAY RUTAS REGISTRADAS');
    }
  } else {
    console.log('   ❌ El router no tiene stack o es inválido');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ DIAGNÓSTICO COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════\n');

} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error(error.stack);
}