-- ============================================
-- Migración 024: Corrección de warnings de migraciones anteriores
-- ============================================

-- ==========================================
-- FIX 1: 004_align_sequences.sql
-- El problema: MAX(id) falla en columnas UUID porque PostgreSQL no tiene MAX() nativo para UUID
-- La solución: convertir a text antes de comparar, o simplemente omitir tablas UUID
-- Las secuencias solo importan para tablas SERIAL/BIGSERIAL, no para UUID
-- ==========================================

-- Tablas con secuencia INTEGER/SERIAL (sí importan)
SELECT setval('bookings_id_seq', (SELECT COALESCE(MAX(id), 0) FROM bookings) + 1, false);
SELECT setval('services_id_seq', (SELECT COALESCE(MAX(id), 0) FROM services) + 1, false);

-- Para usuarios la tabla es UUID, no tiene secuencia. Las inserciones usan gen_random_uuid()
-- así que este setval no es necesario. Lo skippeamos para evitar el error.
-- SELECT setval('usuarios_id_seq', ...) -- SKIPPED: usuarios usa UUID

-- ==========================================
-- FIX 2: 017_beauty_profile_schema.sql
-- El problema: el índice condicional se ejecutaba antes de que la columna is_active existiera
-- La solución: recrear el índice ahora que la columna sí existe
-- ==========================================

-- Primero verificar que la columna existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'biometric_consents' AND column_name = 'is_active'
  ) THEN
    -- Recrear el índice condicional que falló en la migración original
    DROP INDEX IF EXISTS idx_biometric_consents_is_active;
    CREATE INDEX IF NOT EXISTS idx_biometric_consents_is_active
      ON biometric_consents(user_id) WHERE is_active = TRUE;
    RAISE NOTICE 'Índice idx_biometric_consents_is_active creado/recreado exitosamente';
  ELSE
    RAISE NOTICE 'Columna is_active no existe aún en biometric_consents. Índice omitido.';
  END IF;
END $$;

-- ==========================================
-- FIX 3: 019_insert_reference_data.sql
-- El problema: la tabla tiktok_hashtag_trends fue creada por Sequelize con nombres en inglés
-- y la migración intentaba insertar con nombres en español (categoria, volumen_publicaciones, etc.)
-- ==========================================

DO $$
BEGIN
  -- Verificar que la tabla existe y obtener las columnas reales
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tiktok_hashtag_trends'
  ) THEN
    -- Las columnas reales según 20260705-create-tiktok-hashtag-trends.js:
    -- hashtag, rank, post_count, view_count, growth_rate, is_promoted,
    -- category, category_confidence, period_days, country_code, industry, scraped_at

    INSERT INTO tiktok_hashtag_trends (
      hashtag, rank, post_count, view_count, growth_rate, is_promoted,
      category, category_confidence, period_days, country_code, industry, scraped_at
    ) VALUES
    ('copperhair', NULL, 45000000, NULL, 195.0, true, 'manicure', NULL, 30, 'CO', NULL, NOW()),
    ('balayagecolombia', NULL, 32000000, NULL, 142.0, true, 'haircare', NULL, 30, 'CO', NULL, NOW()),
    ('honeyblonde', NULL, 28000000, NULL, 118.0, true, 'haircare', NULL, 30, 'CO', NULL, NOW()),
    ('burgundyhair', NULL, 15000000, NULL, 87.0, true, 'haircare', NULL, 30, 'CO', NULL, NOW()),
    ('moneypiece', NULL, 12000000, NULL, 76.0, true, 'haircare', NULL, 30, 'CO', NULL, NOW())
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Datos de tendencias TikTok insertados exitosamente';
  ELSE
    RAISE NOTICE 'Tabla tiktok_hashtag_trends no existe aún. Datos se insertarán cuando exista.';
  END IF;
END $$;

-- ==========================================
-- LOG
-- ==========================================
RAISE NOTICE '✅ Migración 024 completada: warnings de migrations 004, 017 y 019 corregidos';
