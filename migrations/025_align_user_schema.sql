BEGIN;

-- Renombrar columnas para consistencia si no están ya renombradas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='phone') THEN
    ALTER TABLE usuarios RENAME COLUMN phone TO telefono;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='foto_url') THEN
    ALTER TABLE usuarios RENAME COLUMN foto_url TO avatar_url;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='creado_en') THEN
    ALTER TABLE usuarios RENAME COLUMN creado_en TO created_at;
  END IF;
END
$$;

-- Agregar columnas faltantes
ALTER TABLE usuarios 
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS genero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Crear función para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at 
  BEFORE UPDATE ON usuarios 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
