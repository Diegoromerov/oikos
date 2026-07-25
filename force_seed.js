const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_URL ? {} : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  }),
});

async function main() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully. Force seeding provider data...');

    // 1. Limpiar registros conflictivos de los IDs que vamos a insertar para evitar errores de clave duplicada
    await client.query('DELETE FROM reviews WHERE provider_id = 5 OR client_id = 6;');
    await client.query('DELETE FROM bookings WHERE provider_id = 5 OR client_id = 6;');
    await client.query('DELETE FROM portfolio_items WHERE provider_id = 5;');
    await client.query('DELETE FROM services WHERE provider_id = 5;');
    await client.query('DELETE FROM perfiles_prestador WHERE id = 5;');
    await client.query('DELETE FROM usuarios WHERE id IN (5, 6);');

    console.log('Inserting usuarios (Provider: provider@beautyapp.com, Client: miusuario@correo.com)...');
    // Contraseña: password123
    await client.query(`
      INSERT INTO usuarios (id, email, password_hash, nombre, phone, auth_provider, provider_id, rol, onboarding_completo) 
      VALUES 
      (5, 'provider@beautyapp.com', '$2a$10$XG3dsKkJJFx9cldnFJHGt.FJqYVTNiSsoJAaSVwUQkYis22mXk/7O', 'Ana Silva Estilista', '+573159876543', 'LOCAL', 'local_provider@beautyapp.com', 'PRESTADOR', true),
      (6, 'miusuario@correo.com', '$2a$10$XG3dsKkJJFx9cldnFJHGt.FJqYVTNiSsoJAaSVwUQkYis22mXk/7O', 'Cliente de Prueba', '+573000000001', 'LOCAL', 'local_miusuario@correo.com', 'CLIENTE', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Actualizar secuencia del serial
    await client.query("SELECT setval('usuarios_id_seq', GREATEST((SELECT MAX(id) FROM usuarios), 6));");

    console.log('Inserting profile for Ana Silva...');
    await client.query(`
      INSERT INTO perfiles_prestador (id, business_name, description, is_online, estatus_verificacion, ubicacion, metodo_retiro, numero_cuenta_nequi, documento_titular, rating_avg, rating_count, is_active) 
      VALUES 
      (5, 'Ana Silva Premium Beauty', 'Estilista profesional certificada con más de 8 años de experiencia en colorimetría, cortes de vanguardia, maquillaje de gala y diseño de cejas. Servicio personalizado a domicilio en Fontibón.', true, 'APROBADO', ST_SetSRID(ST_MakePoint(-74.1385, 4.6720), 4326), 'NEQUI', '+573159876543', '1020444555', 4.9, 2, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Inserting services...');
    await client.query(`
      INSERT INTO services (id, provider_id, name, description, price, duration_minutes, category, is_active) 
      VALUES 
      ('a0000000-0000-0000-0000-000000000005', 5, 'Corte de Cabello Premium + Peinado', 'Corte personalizado adaptado a tu rostro, lavado orgánico con masaje capilar y cepillado estilizado profesional.', 45000.00, 60, 'hair', true),
      ('a0000000-0000-0000-0000-000000000105', 5, 'Maquillaje Profesional de Noche', 'Maquillaje glam de alta duración para eventos, incluye preparación e hidratación de piel y pestañas por punto.', 80000.00, 90, 'makeup', true),
      ('a0000000-0000-0000-0000-000000000205', 5, 'Manicura + Pedicura Spa', 'Limpieza profunda, exfoliación de sales minerales, esmaltado semipermanente de larga duración y diseños minimalistas a elección.', 50000.00, 80, 'nails', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Inserting portfolio items...');
    await client.query(`
      INSERT INTO portfolio_items (id, provider_id, image_url, title, category, likes_count) 
      VALUES 
      ('f0000000-0000-0000-0000-000000000001', 5, 'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=600&auto=format&fit=crop', 'Rubio Balayage Cenizo', 'hair', 15),
      ('f0000000-0000-0000-0000-000000000002', 5, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=600&auto=format&fit=crop', 'Maquillaje Glam Noche', 'makeup', 28),
      ('f0000000-0000-0000-0000-000000000003', 5, 'https://images.unsplash.com/photo-1604654894610-df49068853b0?q=80&w=600&auto=format&fit=crop', 'Uñas Semipermanentes Pastel', 'nails', 12)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Inserting bookings history...');
    await client.query(`
      INSERT INTO bookings (id, client_id, provider_id, service_id, scheduled_at, valor_bruto, estado, pin_verificacion) 
      VALUES 
      ('b0000000-0000-0000-0000-000000000005', 4, 5, 'a0000000-0000-0000-0000-000000000005', '2026-05-20 10:00:00+00', 45000.00, 'COMPLETADA', '1122'),
      ('b0000000-0000-0000-0000-000000000105', 6, 5, 'a0000000-0000-0000-0000-000000000105', '2026-05-22 18:00:00+00', 80000.00, 'COMPLETADA', '3344')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Inserting reviews...');
    await client.query(`
      INSERT INTO reviews (id, booking_id, client_id, provider_id, rating, comment) 
      VALUES 
      ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 4, 5, 5, '¡Ana es maravillosa! Hizo un trabajo increíble con mi cabello, súper recomendada.'),
      ('c0000000-0000-0000-0000-000000000105', 'b0000000-0000-0000-0000-000000000105', 6, 5, 5, 'El maquillaje duró toda la noche y captó exactamente lo que quería. Volveré a reservar.')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✅ DATABASE FORCE SEED COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error force-seeding database:', err);
  } finally {
    await client.end();
  }
}

main();
