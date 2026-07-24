-- Crear tabla color_references si no existe
CREATE TABLE IF NOT EXISTS color_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(100) NOT NULL,
    reference VARCHAR(50) NOT NULL,
    color_name VARCHAR(200) NOT NULL,
    undertone VARCHAR(50) NOT NULL,
    tone_level INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar colores de las 10 marcas principales
INSERT INTO color_references (brand, reference, color_name, undertone, tone_level) VALUES
('L''Oréal', '1.0', 'Negro Natural', 'neutral', 1),
('L''Oréal', '5.3', 'Castaño Claro Dorado', 'warm', 5),
('L''Oréal', '7.43', 'Rubio Cobre Dorado', 'warm', 7),
('L''Oréal', '9.1', 'Rubio Muy Claro Ceniza', 'cold', 9),
('Schwarzkopf', '4-0', 'Castaño Medio Natural', 'neutral', 4),
('Schwarzkopf', '6-88', 'Rubio Oscuro Rojo Intenso', 'warm', 6),
('Schwarzkopf', '8-0', 'Rubio Claro Natural', 'neutral', 8),
('Wella', '3/0', 'Castaño Oscuro', 'neutral', 3),
('Wella', '7/43', 'Rubio Medio Rojo Dorado', 'warm', 7),
('Wella', '10/1', 'Rubio Extra Claro Ceniza', 'cold', 10)
ON CONFLICT DO NOTHING;

-- Insertar tendencias TikTok Colombia actuales usando las columnas correctas en español
INSERT INTO tiktok_hashtag_trends (hashtag, categoria, categoria_label, volumen_publicaciones, tendencia_pct, es_nuevo, fecha_extraccion, pais, periodo_consulta) VALUES
('copperhair', 'trending_colors', 'Trending Colors', 45000000, 195, true, NOW(), 'CO', 30),
('balayagecolombia', 'techniques', 'Techniques', 32000000, 142, true, NOW(), 'CO', 30),
('honeyblonde', 'trending_colors', 'Trending Colors', 28000000, 118, true, NOW(), 'CO', 30),
('burgundyhair', 'trending_colors', 'Trending Colors', 15000000, 87, true, NOW(), 'CO', 30),
('moneyPiece', 'techniques', 'Techniques', 12000000, 76, true, NOW(), 'CO', 30);
