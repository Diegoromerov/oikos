const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:3d3aB6gecf1dcCdB653CGD2dee23dG4A@caboose.proxy.rlwy.net:18931/railway';

// Ejecutar cada statement individualmente para evitar ECONNRESET
const statements = [
  // USUARIOS
  `INSERT INTO usuarios (id,email,password_hash,nombre,phone,auth_provider,provider_id,rol,onboarding_completo) VALUES
(101,'carolina.hair@bellezaapp.com','$2b$12$K7vXbM8Wz2oPl9R1NqYeOu1AhGj5FkLmNpQrStUvWxYzAbCdEfGhI','Carolina Mendoza Rios','+573124567890','LOCAL','local_carolina','PRESTADOR',true),
(102,'santiago.barber@bellezaapp.com','$2b$12$E8mZnP9L4xQwK2j1TvYbUo3BiHk6GmNqPrStUvWxYzAbCdEfGhJ','Santiago Castro Devia','+573157890123','LOCAL','local_santiago','PRESTADOR',true),
(103,'valeria.makeup@bellezaapp.com','$2b$12$V3bNmK8Wz1oPl9R2XqYeOu4AhGj6FkLmNpQrStUvWxYzAbCdEfGhK','Valeria Sofia Tobon','+573203456789','LOCAL','local_valeria','PRESTADOR',true),
(104,'prov_nails_001@bellezaapp.com','$2b$12$B9nKj8Wz3oPl9R1NqYeOu2AhGj4FkLmNpQrStUvWxYzAbCdEfGhL','Ana Silva Torres','+573159876543','LOCAL','local_ana_silva','PRESTADOR',true),
(105,'diana.facials@bellezaapp.com','$2b$12$Z1xCvB9NqWeRtYuIoPaSdFgHjKlZxCvBnMqWeRtYuIoPaSdFgHjK','Diana Marcela Gomez','+573186543210','LOCAL','local_diana','PRESTADOR',true),
(1,'cliente.demo@bellezaapp.com','$2b$12$K7vXbM8Wz2oPl9R1NqYeOu1AhGj5FkLmNpQrStUvWxYzAbCdEfGhI','Cliente Demo','+573100000001','LOCAL','local_cliente_demo','CLIENTE',true)
ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre,phone=EXCLUDED.phone`,

  // FOTOS
  `UPDATE usuarios SET foto_url='https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' WHERE id=101`,
  `UPDATE usuarios SET foto_url='https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop' WHERE id=102`,
  `UPDATE usuarios SET foto_url='https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop' WHERE id=103`,
  `UPDATE usuarios SET foto_url='https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' WHERE id=104`,
  `UPDATE usuarios SET foto_url='https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop' WHERE id=105`,

  // PERFILES
  `INSERT INTO perfiles_prestador (id,business_name,description,is_online,estatus_verificacion,ubicacion,metodo_retiro,numero_cuenta_nequi,documento_titular,rating_avg,rating_count,is_active) VALUES
(101,'Carolina Hair Studio','Especialista en Balayage y Colorimetria Avanzada',true,'APROBADO',ST_SetSRID(ST_MakePoint(-74.1420,4.6730),4326),'NEQUI','+573124567890','1018333222',4.8,10,true),
(102,'Santiago Barber Shop','Barberia clasica y corte masculino moderno',true,'APROBADO',ST_SetSRID(ST_MakePoint(-74.1360,4.6750),4326),'NEQUI','+573157890123','1019444333',4.7,8,true),
(103,'Valeria Tobon Makeup','Maquillaje profesional para eventos y novias',true,'APROBADO',ST_SetSRID(ST_MakePoint(-74.1460,4.6710),4326),'NEQUI','+573203456789','1020555444',4.9,15,true),
(104,'Ana Silva Nail Art','Manicura semipermanente y extensiones de unas',true,'APROBADO',ST_SetSRID(ST_MakePoint(-74.1385,4.6720),4326),'NEQUI','+573159876543','1021666555',4.6,6,true),
(105,'Diana Gomez Estetica','Tratamientos faciales hidratacion y limpieza profunda',true,'APROBADO',ST_SetSRID(ST_MakePoint(-74.1310,4.6780),4326),'NEQUI','+573186543210','1022777666',4.9,12,true)
ON CONFLICT (id) DO UPDATE SET business_name=EXCLUDED.business_name,description=EXCLUDED.description,is_active=EXCLUDED.is_active`,

  // SERVICIOS
  `INSERT INTO services (id,provider_id,name,description,price,duration_minutes,category,is_active) VALUES
('00000000-0000-0000-0000-000000000101',101,'Balayage Cenizo + Hidratacion Plex','Tecnica de iluminacion capilar.',320000,180,'hair',true),
('00000000-0000-0000-0000-000000000102',101,'Corte Tendencia + Cepillado','Corte moderno personalizado.',65000,60,'hair',true),
('00000000-0000-0000-0000-000000000201',102,'Corte Premium + Perfilado de Barba','Corte y afeitado tradicional.',45000,50,'hair',true),
('00000000-0000-0000-0000-000000000202',102,'Camuflaje de Canas Masculino','Cobertura rapida de canas.',50000,40,'hair',true),
('00000000-0000-0000-0000-000000000301',103,'Maquillaje Social Premium','Maquillaje elegante larga duracion.',140000,75,'makeup',true),
('00000000-0000-0000-0000-000000000302',103,'Maquillaje de Novia Con Prueba','Maquillaje especial con prueba.',280000,120,'makeup',true),
('00000000-0000-0000-0000-000000000401',104,'Manicura Tradicional Express','Cuidado de unas express.',28000,40,'nails',true),
('00000000-0000-0000-0000-000000000402',104,'Manicura Semipermanente Profesional','Esmaltado semipermanente.',55000,60,'nails',true),
('00000000-0000-0000-0000-000000000403',104,'Manicura + Pedicura Spa Combo','Combo spa manos y pies.',85000,90,'nails',true),
('00000000-0000-0000-0000-000000000404',104,'Extension de Unas en Gel-X','Extensiones elegantes.',120000,100,'nails',true),
('00000000-0000-0000-0000-000000000405',104,'Kapping Base Ruber','Recubrimiento fortalecedor.',75000,75,'nails',true),
('00000000-0000-0000-0000-000000000501',105,'Limpieza Facial Profunda','Limpieza profunda de impurezas.',95000,75,'facials',true),
('00000000-0000-0000-0000-000000000502',105,'Hidratacion Acido Hialuronico','Tratamiento hidratante intensivo.',120000,60,'facials',true)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,is_active=EXCLUDED.is_active`,

  // PORTAFOLIO - limpiar y reinsertar
  `DELETE FROM portfolio_items WHERE provider_id IN (101,102,103,104,105)`,

  `INSERT INTO portfolio_items (id,provider_id,image_url,title,category) VALUES
('e1010000-0000-0000-0000-000000000001',101,'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800','Balayage Cenizo Premium','hair'),
('e1010000-0000-0000-0000-000000000002',101,'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?q=80&w=800','Cabello Iluminado Ondas','hair'),
('e1010000-0000-0000-0000-000000000003',101,'https://images.unsplash.com/photo-1522337360788-8b13df793f1f?q=80&w=800','Corte Bob Estilizado','hair'),
('e1010000-0000-0000-0000-000000000004',101,'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?q=80&w=800','Diseno de Color Fantasia','hair'),
('e1020000-0000-0000-0000-000000000001',102,'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800','Mid Fade Clasico','hair'),
('e1020000-0000-0000-0000-000000000002',102,'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800','Afeitado y Toalla Caliente','hair'),
('e1020000-0000-0000-0000-000000000003',102,'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=800','Pompadour Perfilado','hair'),
('e1020000-0000-0000-0000-000000000004',102,'https://images.unsplash.com/photo-1593702295094-aec22597af65?q=80&w=800','Degradado Barba Disenada','hair'),
('e1030000-0000-0000-0000-000000000001',103,'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800','Maquillaje Ojos Smokey','makeup'),
('e1030000-0000-0000-0000-000000000002',103,'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800','Maquillaje Novia Natural','makeup'),
('e1030000-0000-0000-0000-000000000003',103,'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?q=80&w=800','Maquillaje Glam de Gala','makeup'),
('e1030000-0000-0000-0000-000000000004',103,'https://images.unsplash.com/photo-1526045478516-99145907023c?q=80&w=800','Maquillaje Editorial Color','makeup'),
('e1040000-0000-0000-0000-000000000001',104,'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800','Manicura Semipermanente Roja','nails'),
('e1040000-0000-0000-0000-000000000002',104,'https://images.unsplash.com/photo-1629732047847-50b7ef46c3bb?q=80&w=800','Diseno Frances Clasico','nails'),
('e1040000-0000-0000-0000-000000000003',104,'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=800','Unas Nude Minimalistas','nails'),
('e1040000-0000-0000-0000-000000000004',104,'https://images.unsplash.com/photo-1632345031435-8797b2d58045?q=80&w=800','Gel-X Brillo Escarcha','nails'),
('e1050000-0000-0000-0000-000000000001',105,'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=800','Limpieza Facial Exfoliante','facials'),
('e1050000-0000-0000-0000-000000000002',105,'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800','Mascarilla de Arcilla','facials'),
('e1050000-0000-0000-0000-000000000003',105,'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800','Masaje Facial Relajante','facials'),
('e1050000-0000-0000-0000-000000000004',105,'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?q=80&w=800','Piel Radiante Post Tratamiento','facials')
ON CONFLICT (id) DO NOTHING`,

  // BOOKINGS
  `INSERT INTO bookings (id,client_id,provider_id,service_id,scheduled_at,valor_bruto,estado,pin_verificacion,payment_status) VALUES
('b0000000-0000-0000-0000-000000000101',1,101,'00000000-0000-0000-0000-000000000101',NOW()-INTERVAL '5 days',320000,'COMPLETADA','1111','paid'),
('b0000000-0000-0000-0000-000000000102',1,101,'00000000-0000-0000-0000-000000000102',NOW()-INTERVAL '4 days',65000,'COMPLETADA','2222','paid'),
('b0000000-0000-0000-0000-000000000201',1,102,'00000000-0000-0000-0000-000000000201',NOW()-INTERVAL '5 days',45000,'COMPLETADA','3333','paid'),
('b0000000-0000-0000-0000-000000000202',1,102,'00000000-0000-0000-0000-000000000202',NOW()-INTERVAL '4 days',50000,'COMPLETADA','4444','paid'),
('b0000000-0000-0000-0000-000000000301',1,103,'00000000-0000-0000-0000-000000000301',NOW()-INTERVAL '5 days',140000,'COMPLETADA','5555','paid'),
('b0000000-0000-0000-0000-000000000302',1,103,'00000000-0000-0000-0000-000000000302',NOW()-INTERVAL '4 days',280000,'COMPLETADA','6666','paid'),
('b0000000-0000-0000-0000-000000000401',1,104,'00000000-0000-0000-0000-000000000402',NOW()-INTERVAL '5 days',55000,'COMPLETADA','7777','paid'),
('b0000000-0000-0000-0000-000000000402',1,104,'00000000-0000-0000-0000-000000000404',NOW()-INTERVAL '4 days',120000,'COMPLETADA','8888','paid'),
('b0000000-0000-0000-0000-000000000501',1,105,'00000000-0000-0000-0000-000000000501',NOW()-INTERVAL '5 days',95000,'COMPLETADA','9999','paid'),
('b0000000-0000-0000-0000-000000000502',1,105,'00000000-0000-0000-0000-000000000502',NOW()-INTERVAL '4 days',120000,'COMPLETADA','0000','paid')
ON CONFLICT (id) DO NOTHING`,

  // REVIEWS
  `INSERT INTO reviews (booking_id,client_id,provider_id,rating,comment) VALUES
('b0000000-0000-0000-0000-000000000101',1,101,5,'El balayage me quedo increible! Super profesional.'),
('b0000000-0000-0000-0000-000000000102',1,101,5,'Me encanto el corte tendencia. Muy profesional.'),
('b0000000-0000-0000-0000-000000000201',1,102,5,'Excelente perfilado de barba y trato premium.'),
('b0000000-0000-0000-0000-000000000202',1,102,4,'Buen trabajo disimulando las canas. Rapido y limpio.'),
('b0000000-0000-0000-0000-000000000301',1,103,5,'El maquillaje me duro toda la noche. Excelente!'),
('b0000000-0000-0000-0000-000000000302',1,103,5,'La prueba de maquillaje fue perfecta. Muy atenta.'),
('b0000000-0000-0000-0000-000000000401',1,104,4,'Buen servicio de semipermanente, amplio catalogo.'),
('b0000000-0000-0000-0000-000000000402',1,104,5,'Las extensiones Gel-X quedaron super naturales.'),
('b0000000-0000-0000-0000-000000000501',1,105,5,'Limpieza facial fue un spa completo. Piel hermosa.'),
('b0000000-0000-0000-0000-000000000502',1,105,5,'Increible hidratacion, muy recomendado a domicilio.')
ON CONFLICT (booking_id) DO NOTHING`,

  // RATINGS
  `UPDATE perfiles_prestador SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE provider_id=101),rating_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=101) WHERE id=101`,
  `UPDATE perfiles_prestador SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE provider_id=102),rating_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=102) WHERE id=102`,
  `UPDATE perfiles_prestador SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE provider_id=103),rating_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=103) WHERE id=103`,
  `UPDATE perfiles_prestador SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE provider_id=104),rating_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=104) WHERE id=104`,
  `UPDATE perfiles_prestador SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE provider_id=105),rating_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=105) WHERE id=105`,

  // HORARIOS
  `UPDATE perfiles_prestador SET active_start_hour=8,active_end_hour=17,weekly_schedule='{"lunes":{"activo":true,"inicio":8,"fin":17},"martes":{"activo":true,"inicio":8,"fin":17},"miercoles":{"activo":true,"inicio":8,"fin":17},"jueves":{"activo":true,"inicio":8,"fin":17},"viernes":{"activo":true,"inicio":8,"fin":17},"sabado":{"activo":true,"inicio":8,"fin":14},"domingo":{"activo":false,"inicio":0,"fin":0}}'::jsonb WHERE id=101`,
  `UPDATE perfiles_prestador SET active_start_hour=10,active_end_hour=19,weekly_schedule='{"lunes":{"activo":true,"inicio":10,"fin":19},"martes":{"activo":true,"inicio":10,"fin":19},"miercoles":{"activo":true,"inicio":10,"fin":19},"jueves":{"activo":true,"inicio":10,"fin":19},"viernes":{"activo":true,"inicio":10,"fin":19},"sabado":{"activo":true,"inicio":10,"fin":19},"domingo":{"activo":true,"inicio":10,"fin":16}}'::jsonb WHERE id=102`,
  `UPDATE perfiles_prestador SET active_start_hour=7,active_end_hour=15,weekly_schedule='{"lunes":{"activo":false,"inicio":0,"fin":0},"martes":{"activo":true,"inicio":7,"fin":15},"miercoles":{"activo":true,"inicio":7,"fin":15},"jueves":{"activo":true,"inicio":7,"fin":15},"viernes":{"activo":true,"inicio":7,"fin":15},"sabado":{"activo":true,"inicio":7,"fin":15},"domingo":{"activo":false,"inicio":0,"fin":0}}'::jsonb WHERE id=103`,
  `UPDATE perfiles_prestador SET active_start_hour=11,active_end_hour=20,weekly_schedule='{"lunes":{"activo":true,"inicio":11,"fin":20},"martes":{"activo":true,"inicio":11,"fin":20},"miercoles":{"activo":true,"inicio":11,"fin":20},"jueves":{"activo":true,"inicio":11,"fin":20},"viernes":{"activo":true,"inicio":11,"fin":20},"sabado":{"activo":true,"inicio":9,"fin":17},"domingo":{"activo":false,"inicio":0,"fin":0}}'::jsonb WHERE id=104`,
  `UPDATE perfiles_prestador SET active_start_hour=8,active_end_hour=16,weekly_schedule='{"lunes":{"activo":true,"inicio":8,"fin":16},"martes":{"activo":true,"inicio":8,"fin":16},"miercoles":{"activo":true,"inicio":8,"fin":16},"jueves":{"activo":true,"inicio":8,"fin":16},"viernes":{"activo":true,"inicio":8,"fin":16},"sabado":{"activo":true,"inicio":8,"fin":14},"domingo":{"activo":false,"inicio":0,"fin":0}}'::jsonb WHERE id=105`,
];

const labels = [
  'Usuarios (6)', 'Foto 101', 'Foto 102', 'Foto 103', 'Foto 104', 'Foto 105',
  'Perfiles (5)', 'Servicios (13)', 'DELETE portfolio', 'Portfolio (20)',
  'Bookings (10)', 'Reviews (10)',
  'Rating 101', 'Rating 102', 'Rating 103', 'Rating 104', 'Rating 105',
  'Horario 101', 'Horario 102', 'Horario 103', 'Horario 104', 'Horario 105',
];

async function run() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log('🔌 Conectando a Railway...');
    await client.connect();
    console.log('✅ Conectado!\n');

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        console.log(`  ✅ ${labels[i] || 'Step ' + i}`);
      } catch (e) {
        console.log(`  ⚠️  ${labels[i] || 'Step ' + i}: ${e.message}`);
      }
    }

    // Verificacion final
    const r = await client.query(`
      SELECT 'usuarios'  AS tabla,COUNT(*) AS n FROM usuarios          WHERE id IN (101,102,103,104,105)
      UNION ALL SELECT 'perfiles', COUNT(*) FROM perfiles_prestador WHERE id IN (101,102,103,104,105)
      UNION ALL SELECT 'services', COUNT(*) FROM services           WHERE provider_id IN (101,102,103,104,105)
      UNION ALL SELECT 'portfolio',COUNT(*) FROM portfolio_items    WHERE provider_id IN (101,102,103,104,105)
      UNION ALL SELECT 'bookings', COUNT(*) FROM bookings           WHERE provider_id IN (101,102,103,104,105)
      UNION ALL SELECT 'reviews',  COUNT(*) FROM reviews            WHERE provider_id IN (101,102,103,104,105)
    `);
    console.log('\n📊 RESULTADO FINAL:');
    console.table(r.rows);
  } catch (e) {
    console.error('❌ Error de conexion:', e.message);
  } finally {
    await client.end();
  }
}

run();
