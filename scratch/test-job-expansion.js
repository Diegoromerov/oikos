// scratch/test-job-expansion.js
require('dotenv').config();
const { executeWeeklyScrape } = require('../src/modules/tiktok-trends/jobs/weeklyTiktokTrendsJob');
const { pool } = require('../src/config/db');

(async () => {
  console.log('🧪 Iniciando prueba del Job Semanal Expandido...');
  
  // Ejecutar el job semanal
  await executeWeeklyScrape();
  
  // Consultar registros en DB
  console.log('\n📊 VERIFICANDO CONTENIDO EN BASE DE DATOS:');
  try {
    const hashtags = await pool.query('SELECT COUNT(*) as count FROM tiktok_hashtag_trends');
    console.log(`- Hashtags guardados: ${hashtags.rows[0].count}`);
    
    const songs = await pool.query('SELECT COUNT(*) as count FROM tiktok_song_trends');
    console.log(`- Canciones guardadas: ${songs.rows[0].count}`);
    
    const creators = await pool.query('SELECT COUNT(*) as count FROM tiktok_creator_trends');
    console.log(`- Creadores guardados: ${creators.rows[0].count}`);
    
    const ads = await pool.query('SELECT COUNT(*) as count FROM tiktok_beauty_ads');
    console.log(`- Anuncios de belleza guardados: ${ads.rows[0].count}`);
    
    console.log('\nMuestra de Canciones:');
    const songsSample = await pool.query('SELECT title, artist, videos_count FROM tiktok_song_trends LIMIT 3');
    console.table(songsSample.rows);

    console.log('\nMuestra de Creadores:');
    const creatorsSample = await pool.query('SELECT username, followers, category FROM tiktok_creator_trends LIMIT 3');
    console.table(creatorsSample.rows);

    console.log('\nMuestra de Anuncios:');
    const adsSample = await pool.query('SELECT brand, title, impressions, ctr FROM tiktok_beauty_ads LIMIT 2');
    console.table(adsSample.rows);

  } catch (err) {
    console.error('❌ Error consultando tablas:', err.message);
  } finally {
    await pool.end();
    console.log('\nPrueba finalizada.');
  }
})();
