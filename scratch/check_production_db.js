// backend/scratch/check_production_db.js
const { Pool } = require('pg');
require('dotenv').config();

// Creamos un pool de conexión temporal usando la URL de Railway (producción)
// Para que funcione, el usuario debe tener configurado DATABASE_URL en su .env local
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: La variable DATABASE_URL no está configurada en el archivo backend/.env local.');
  console.log('Por favor, copia la URL de conexión de producción de Railway y agrégala temporalmente a backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const run = async () => {
  try {
    const email = 'diegomartinromero@gmail.com';
    console.log(`🔍 Conectando a la Base de Datos de Producción (Railway)...`);
    console.log(`🔍 Buscando información para el correo: ${email}`);
    
    const result = await pool.query(
      'SELECT id, nombre, email, auth_provider, provider_id, rol, onboarding_completo, is_active FROM usuarios WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontró ningún usuario con ese correo en la BD de Producción.');
    } else {
      console.log('✅ Usuarios encontrados en la base de datos de Producción:');
      console.log(JSON.stringify(result.rows, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error consultando la base de datos de Producción:', err);
    process.exit(1);
  }
};

run();
