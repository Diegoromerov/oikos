// backend/src/controllers/serviceController.js
const Service = require('../models/Service');

// GET /api/services/provider → Lista servicios del provider
exports.getProviderServices = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Acceso denegado: solo para proveedores' });
    }

    const services = await Service.findAll({
      where: { provider_id: req.user.id },
      order: [['name', 'ASC']]
    });

    const formattedServices = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description || '',
      price: parseFloat(service.price) || 0.0,
      duration_minutes: parseInt(service.duration_minutes) || 30,
      category: service.category || '',
      is_active: !!service.is_active
    }));

    res.json({ success: true, count: formattedServices.length, data: formattedServices });
  } catch (error) {
    console.error('❌ ERROR EN GET /api/services/provider:', { message: error.message });
    res.status(500).json({ error: 'Error interno al obtener servicios' });
  }
};

// POST /api/services → Crea servicio
exports.createService = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Acceso denegado: solo para proveedores' });
    }

    const { name, description, price, duration_minutes, category, is_active } = req.body;
    if (!name || price === undefined || !duration_minutes) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, precio, duración)' });
    }

    const parsedPrice = parseFloat(price);
    const parsedDuration = parseInt(duration_minutes);
    const isActiveVal = is_active !== false;

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Precio inválido' });
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({ error: 'Duración inválida' });
    }

    const service = await Service.create({
      provider_id: req.user.id,
      name,
      description: description || null,
      price: parsedPrice,
      duration_minutes: parsedDuration,
      category: category || null,
      is_active: isActiveVal
    });

    res.status(201).json({
      success: true,
      message: 'Servicio creado exitosamente',
      service: {
        id: service.id,
        provider_id: service.provider_id,
        name: service.name,
        description: service.description,
        price: parseFloat(service.price),
        duration_minutes: parseInt(service.duration_minutes),
        category: service.category,
        is_active: service.is_active
      }
    });
  } catch (error) {
    console.error('❌ ERROR EN POST /api/services:', { message: error.message });
    res.status(500).json({ error: 'Error interno al crear el servicio' });
  }
};

// PUT /api/services/:id → Actualiza servicio
exports.updateService = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Acceso denegado: solo para proveedores' });
    }

    const serviceId = req.params.id;
    const providerId = req.user.id;
    const { name, description, price, duration_minutes, category, is_active } = req.body;

    const service = await Service.findOne({
      where: { id: serviceId, provider_id: providerId }
    });

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado o no te pertenece' });
    }

    if (!name || price === undefined || !duration_minutes) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, precio, duración)' });
    }

    const parsedPrice = parseFloat(price);
    const parsedDuration = parseInt(duration_minutes);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Precio inválido' });
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({ error: 'Duración inválida' });
    }

    service.name = name;
    service.description = description || null;
    service.price = parsedPrice;
    service.duration_minutes = parsedDuration;
    service.category = category || null;
    service.is_active = is_active !== false;

    await service.save();

    res.json({
      success: true,
      message: 'Servicio actualizado exitosamente',
      service: {
        id: service.id,
        provider_id: service.provider_id,
        name: service.name,
        description: service.description,
        price: parseFloat(service.price),
        duration_minutes: parseInt(service.duration_minutes),
        category: service.category,
        is_active: service.is_active
      }
    });
  } catch (error) {
    console.error('❌ ERROR EN PUT /api/services/:id:', { message: error.message });
    res.status(500).json({ error: 'Error interno al actualizar el servicio' });
  }
};

// DELETE /api/services/:id → Soft delete
exports.deleteService = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Acceso denegado: solo para proveedores' });
    }

    const serviceId = req.params.id;
    const providerId = req.user.id;

    const service = await Service.findOne({
      where: { id: serviceId, provider_id: providerId }
    });

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado o no te pertenece' });
    }

    service.is_active = false;
    await service.save();

    res.json({
      success: true,
      message: 'Servicio desactivado exitosamente',
      service: {
        id: service.id,
        name: service.name,
        is_active: service.is_active
      }
    });
  } catch (error) {
    console.error('❌ ERROR EN DELETE /api/services/:id:', { message: error.message });
    res.status(500).json({ error: 'Error interno al desactivar el servicio' });
  }
};
