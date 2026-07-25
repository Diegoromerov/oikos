// backend/scratch/setup_users.js
const { pool } = require('../src/config/db');

async function setup() {
  try {
    const passwordHash = '$2a$10$XG3dsKkJJFx9cldnFJHGt.FJqYVTNiSsoJAaSVwUQkYis22mXk/7O'; // 'password123'
    
    console.log('Upserting user: Diego Romero Velandia (CLIENTE)...');
    await pool.query(`
      INSERT INTO usuarios (email, nombre, auth_provider, provider_id, password_hash, phone, rol, onboarding_completo, is_active)
      VALUES (
        'diego@beautyapp.com', 
        'Diego Romero Velandia', 
        'LOCAL', 
        'local_diego@beautyapp.com', 
        $1, 
        '+573151234567', 
        'CLIENTE', 
        true, 
        true
      )
      ON CONFLICT (email) 
      DO UPDATE SET 
        nombre = 'Diego Romero Velandia',
        rol = 'CLIENTE',
        password_hash = $1,
        provider_id = 'local_diego@beautyapp.com',
        phone = '+573151234567',
        is_active = true,
        onboarding_completo = true;
    `, [passwordHash]);

    console.log('Upserting user: Ana Silva (PRESTADOR)...');
    await pool.query(`
      INSERT INTO usuarios (email, nombre, auth_provider, provider_id, password_hash, phone, rol, onboarding_completo, is_active)
      VALUES (
        'anasilva@beautyapp.com', 
        'Ana Silva', 
        'LOCAL', 
        'local_anasilva@beautyapp.com', 
        $1, 
        '+573159876543', 
        'PRESTADOR', 
        true, 
        true
      )
      ON CONFLICT (email) 
      DO UPDATE SET 
        nombre = 'Ana Silva',
        rol = 'PRESTADOR',
        password_hash = $1,
        provider_id = 'local_anasilva@beautyapp.com',
        phone = '+573159876543',
        is_active = true,
        onboarding_completo = true;
    `, [passwordHash]);

    // Let's also check if they are in the database now:
    const res = await pool.query("SELECT id, email, nombre, rol, phone FROM usuarios WHERE email IN ('diego@beautyapp.com', 'anasilva@beautyapp.com')");
    console.log('--- ACTUAL STATE ---');
    console.table(res.rows);

  } catch (err) {
    console.error('Error setting up users:', err);
  } finally {
    pool.end();
  }
}

setup();
