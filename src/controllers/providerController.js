const { pool } = require('../config/db');

// GET /api/providers → LISTA DE PRESTADORES (Geolocalización con PostGIS)
exports.getProviders = async (req, res) => {
  try {
    let lat = parseFloat(req.query.lat);
    let lon = parseFloat(req.query.lon);
    let radius = parseInt(req.query.radius);

    // Si faltan parámetros, leer configuraciones dinámicas de la base de datos
    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      const configRes = await pool.query(
        "SELECT key, value FROM platform_config WHERE key IN ('gps_centro_latitud', 'gps_centro_longitud', 'gps_default_radio_metros')"
      );
      const configs = {};
      configRes.rows.forEach(r => {
        configs[r.key] = r.value;
      });

      if (isNaN(lat)) lat = parseFloat(configs['gps_centro_latitud'] || '4.6735');
      if (isNaN(lon)) lon = parseFloat(configs['gps_centro_longitud'] || '-74.1422');
      if (isNaN(radius)) radius = parseInt(configs['gps_default_radio_metros'] || '5000');
    }

    // Validación defensiva de rangos
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ success: false, error: 'Coordenadas inválidas' });
    }
    if (radius < 100 || radius > 100000) {
      return res.status(400).json({ success: false, error: 'Radio fuera de rango (100m - 100km)' });
    }

    const query = `
      SELECT 
        p.id, 
        u.nombre as full_name, 
        u.avatar_url as avatar_url,
        p.business_name, 
        p.description,
        p.rating_avg, 
        p.rating_count, 
        (p.estatus_verificacion = 'APROBADO') as is_verified,
        ST_X(p.ubicacion::geometry) AS longitude,
        ST_Y(p.ubicacion::geometry) AS latitude,
        COALESCE(pl.tier, 'Creative Edge') as loyalty_tier,
        ST_Distance(p.ubicacion, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
      FROM perfiles_prestador p
      INNER JOIN usuarios u ON p.id = u.id
      LEFT JOIN provider_loyalty pl ON p.id = pl.provider_id
      WHERE p.is_active = true AND p.estatus_verificacion = 'APROBADO'
        AND ST_DWithin(
          p.ubicacion, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          CASE 
            WHEN COALESCE(pl.tier, 'Creative Edge') = 'Visage Pro' THEN $3 * 1.15
            ELSE $3
          END
        )
      ORDER BY 
        CASE 
          WHEN COALESCE(pl.tier, 'Creative Edge') = 'Avant-Garde Elite' THEN 1
          WHEN COALESCE(pl.tier, 'Creative Edge') = 'Visage Pro' THEN 2
          ELSE 3
        END ASC,
        distance_meters ASC;
    `;

    const result = await pool.query(query, [lon, lat, radius]);

    // Mapeo explícito para tipos nativos
    const formattedProviders = result.rows.map(row => ({
      id: row.id.toString(),
      full_name: row.full_name,
      avatar_url: row.avatar_url || '',
      business_name: row.business_name || '',
      description: row.description || '',
      rating_avg: parseFloat(row.rating_avg) || 0.0,
      rating_count: parseInt(row.rating_count) || 0,
      is_verified: !!row.is_verified,
      loyalty_tier: row.loyalty_tier,
      distance_meters: Math.round(row.distance_meters),
      latitude: parseFloat(row.latitude) || 4.6097,
      longitude: parseFloat(row.longitude) || -74.0817
    }));

    const response = {
      success: true,
      count: formattedProviders.length,
      data: formattedProviders
    };
    
    if (process.env.NODE_ENV === 'development') {
      response.debug = { lat, lon, radius };
    }
    
    res.json(response);

  } catch (error) {
    console.error('❌ ERROR en GET /api/providers:', { 
      message: error.message, 
      code: error.code,
      query: error.query 
    });
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/providers/:id → DETALLE DE UN PRESTADOR (Servicios + Portfolio + Reseñas)
exports.getProviderById = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id);
    if (isNaN(numericId)) return res.status(400).json({ error: 'ID inválido' });
    
    // 1. Datos del proveedor (JOIN con usuarios para foto_url)
    const providerQ = `
      SELECT p.id, u.nombre as full_name, u.foto_url as avatar_url, u.phone, 
             p.business_name, p.description, p.rating_avg, 
             p.rating_count, (p.estatus_verificacion = 'APROBADO') as is_verified 
      FROM perfiles_prestador p 
      JOIN usuarios u ON p.id = u.id 
      WHERE p.id = $1;
    `;
    const providerRes = await pool.query(providerQ, [numericId]);
    if (providerRes.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    const servicesQ = `
      SELECT id, name, description, price, duration_minutes, category 
      FROM services 
      WHERE provider_id = $1 AND is_active = true 
      ORDER BY name;
    `;
    const servicesRes = await pool.query(servicesQ, [numericId]);

    const portfolioQ = `
      SELECT id, image_url, title, category 
      FROM portfolio_items 
      WHERE provider_id = $1 
      ORDER BY created_at DESC LIMIT 10;
    `;
    const portfolioRes = await pool.query(portfolioQ, [numericId]);

    const reviewsQ = `
      SELECT r.rating, r.comment, r.created_at, u.nombre as client_name 
      FROM reviews r 
      JOIN usuarios u ON r.client_id = u.id 
      WHERE r.provider_id = $1 
      ORDER BY r.created_at DESC LIMIT 5;
    `;
    const reviewsRes = await pool.query(reviewsQ, [numericId]);

    res.json({
      success: true,
      data: {
        provider: {
          ...providerRes.rows[0],
          id: providerRes.rows[0].id.toString()
        },
        services: servicesRes.rows,
        portfolio: portfolioRes.rows,
        reviews: reviewsRes.rows
      }
    });
  } catch (error) {
    console.error('❌ ERROR /api/providers/:id:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error interno al cargar detalles' });
  }
};

// GET /api/providers/:id/slots → Obtener slots de tiempo disponibles para un proveedor y fecha específica
exports.getProviderSlots = async (req, res) => {
  try {
    const providerId = req.params.id;
    const { date, service_id } = req.query;

    if (!date || !service_id) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (date, service_id)' });
    }

    const serviceIds = service_id.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (serviceIds.length === 0) {
      return res.status(400).json({ error: 'Formato de service_id inválido' });
    }

    // 1. Obtener la duración total acumulada de los servicios solicitados
    const serviceRes = await pool.query(
      'SELECT SUM(duration_minutes) as total_duration, COUNT(*) as match_count FROM services WHERE id = ANY($1) AND provider_id = $2 AND is_active = true;',
      [serviceIds, providerId]
    );
    if (serviceRes.rows.length === 0 || parseInt(serviceRes.rows[0].match_count) !== serviceIds.length) {
      return res.status(404).json({ error: 'Uno o más servicios no fueron encontrados o están inactivos' });
    }
    const selectedDuration = parseInt(serviceRes.rows[0].total_duration);

    // 2. Obtener todas las citas activas para ese día
    const bookingsQuery = `
      SELECT b.scheduled_at, s.duration_minutes 
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.provider_id = $1 
        AND b.scheduled_at::date = $2::date
        AND b.estado NOT IN ('CANCELADA');
    `;
    const bookingsRes = await pool.query(bookingsQuery, [providerId, date]);
    const activeBookings = bookingsRes.rows.map(row => {
      const start = new Date(row.scheduled_at);
      const duration = parseInt(row.duration_minutes);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      return { start, end };
    });

    // 3. Obtener el horario configurado del prestador
    const hoursRes = await pool.query('SELECT active_start_hour, active_end_hour, weekly_schedule FROM perfiles_prestador WHERE id = $1', [providerId]);
    
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0: domingo, 1: lunes, ..., 6: sabado
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const currentDayName = dayNames[dayOfWeek];

    const weeklySchedule = hoursRes.rows.length > 0 && hoursRes.rows[0].weekly_schedule ? hoursRes.rows[0].weekly_schedule : null;
    let startHour = 6;
    let endHour = 20;
    let isDayActive = true;

    if (weeklySchedule && weeklySchedule[currentDayName]) {
      const dayConf = weeklySchedule[currentDayName];
      isDayActive = dayConf.activo !== false;
      startHour = dayConf.inicio !== undefined ? parseInt(dayConf.inicio) : 6;
      endHour = dayConf.fin !== undefined ? parseInt(dayConf.fin) : 20;
    } else {
      startHour = hoursRes.rows.length > 0 && hoursRes.rows[0].active_start_hour !== null ? parseInt(hoursRes.rows[0].active_start_hour) : 6;
      endHour = hoursRes.rows.length > 0 && hoursRes.rows[0].active_end_hour !== null ? parseInt(hoursRes.rows[0].active_end_hour) : 20;
    }

    if (!isDayActive) {
      return res.json({ success: true, slots: [] });
    }

    const slots = [];
    const startTime = new Date(year, month - 1, day, startHour, 0, 0);
    const endTime = new Date(year, month - 1, day, endHour, 0, 0);

    const now = new Date();

    let currentSlot = new Date(startTime);
    while (currentSlot < endTime) {
      const slotStart = new Date(currentSlot);
      const slotEnd = new Date(slotStart.getTime() + selectedDuration * 60 * 1000);

      // Formato HH:MM
      const hours = String(slotStart.getHours()).padStart(2, '0');
      const minutes = String(slotStart.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      let isAvailable = true;

      // Deshabilitar slots pasados si la fecha consultada es hoy
      if (slotStart < now) {
        isAvailable = false;
      }

      // Si aún está disponible por hora, comprobar colisiones con citas existentes
      if (isAvailable) {
        for (const booking of activeBookings) {
          // Colisión: start1 < end2 AND end1 > start2
          if (slotStart.getTime() < booking.end.getTime() && slotEnd.getTime() > booking.start.getTime()) {
            isAvailable = false;
            break;
          }
        }
      }

      slots.push({
        time: timeStr,
        is_available: isAvailable
      });

      // Incrementar por 30 minutos
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    res.json({
      success: true,
      date,
      service_id,
      slots
    });

  } catch (error) {
    console.error('❌ ERROR EN GET /api/providers/:id/slots:', error);
    res.status(500).json({ error: 'Error interno al obtener slots de tiempo' });
  }
};
