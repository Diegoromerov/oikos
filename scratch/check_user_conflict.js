// backend/scratch/check_user_conflict.js
const { pool } = require('../src/config/db');

const run = async () => {
  try {
    const email = 'diegomartinromero@gmail.com';
    console.log(`🔍 Buscando información para el correo: ${email}`);
    
    const result = await pool.query(
      'SELECT id, nombre, email, auth_provider, provider_id, rol, onboarding_completo, is_active FROM usuarios WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontró ningún usuario con ese correo.');
    } else {
      console.log('✅ Usuarios encontrados en la base de datos:');
      console.log(JSON.stringify(result.rows, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error consultando la base de datos:', err);
    process.exit(1);
  }
};

run();
