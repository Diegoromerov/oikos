// backend/src/startup/app.js
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

// Cargar rutas
const authRoutes = require('../routes/authRoutes');
const paymentRoutes = require('../routes/paymentRoutes');
const bookingRoutes = require('../routes/bookingRoutes');
const serviceRoutes = require('../routes/serviceRoutes');
const chatRoutes = require('../routes/chatRoutes');
const designsRoutes = require('../routes/designsRoutes');
const productRoutes = require('../routes/productRoutes');
const providerRoutes = require('../routes/providerRoutes');
const ticketRoutes = require('../routes/ticketRoutes');
const disputeRoutes = require('../routes/disputeRoutes');
const academyRoutes = require('../routes/academyRoutes');
const academyAdminRoutes = require('../routes/academyAdminRoutes');
const glowAdminRoutes = require('../modules/admin-glow/admin.routes');
const tiktokTrendsModule = require('../modules/tiktok-trends');
const analyticsRoutes = require('../routes/analyticsRoutes');
const userRoutes = require('../routes/userRoutes');
const beauty360Routes = require('../routes/beauty360Routes');

// Middlewares
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { pool } = require('../config/db');

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado. Token inválido.' });
    }
    const { rows } = await pool.query('SELECT rol, email FROM usuarios WHERE id = $1', [req.user.id]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }
    const user = rows[0];
    if (user.rol === 'ADMIN') {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  } catch (error) {
    console.error('Error en adminMiddleware:', error);
    res.status(500).json({ error: 'Error interno de autorización.' });
  }
};

const app = express();

// Configurar uploads de Multer
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
    const hasValidExtension = allowedExtensions.test(file.originalname);
    const hasValidMime = file.mimetype.startsWith('image/') || 
                         (file.mimetype === 'application/octet-stream' && hasValidExtension);
    
    if (hasValidExtension || hasValidMime) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (.jpeg, .jpg, .png, .gif, .webp). Formato recibido: ' + file.mimetype));
    }
  }
});

// Orígenes permitidos CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:7357',
      'http://127.0.0.1:8080',
      'http://localhost:8082',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://belleza-app-production.up.railway.app',
      'https://glowapp-frontend-production.up.railway.app'
    ];

// GZIP Compression & Cors setup
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS bloqueado por política de seguridad'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, '../../public/admin')));
app.use(express.static(path.join(__dirname, '../../public')));

// Canal SSE en tiempo real
const sseClients = [];
app.get('/api/admin/events/stream', authMiddleware, adminMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  console.log(`🔌 [SSE] Administrador conectado. Conectados: ${sseClients.length}`);
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
});

// Servir la aplicación Flutter Web
app.get(/^(?!\/api(?:\/|$))(?!\/uploads(?:\/|$))(?!\/admin(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Configurar Rate Limiters
const generalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP. Por favor intenta de nuevo en un minuto.'
});

const authAndWebhookLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Límite de solicitudes de autenticación/pagos superado. Por favor espera un minuto.'
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authAndWebhookLimiter);
app.use('/api/auth/register', authAndWebhookLimiter);
app.use('/api/auth/send-otp', authAndWebhookLimiter);
app.use('/api/payments/wompi-webhook', authAndWebhookLimiter);

// Enlazar Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api', paymentRoutes);
app.use('/api', bookingRoutes);
app.use('/api', serviceRoutes);
app.use('/api', chatRoutes);
app.use('/api/designs', designsRoutes);
app.use('/api', productRoutes);
app.use('/api', providerRoutes);
app.use('/api', ticketRoutes);
app.use('/api', disputeRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/admin/academy', academyAdminRoutes);
app.use('/api/glow-admin', glowAdminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1/beauty360', beauty360Routes);
app.use('/api/trends', tiktokTrendsModule.router);

// Beauty Scan Proxy API Route
const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://ai-worker:8000';
app.post('/api/v1/beauty-scan', authMiddleware, upload.fields([
  { name: 'face_frontal', maxCount: 1 },
  { name: 'face_lateral', maxCount: 1 },
  { name: 'hair', maxCount: 1 },
  { name: 'hand', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.face_frontal || !req.files.face_lateral || !req.files.hair || !req.files.hand) {
      return res.status(400).json({ error: 'Se requieren las 4 imágenes: face_frontal, face_lateral, hair, hand.' });
    }

    const formData = new FormData();
    const userIdVal = req.body.user_id || req.user.id;
    formData.append('user_id', userIdVal.toString());
    
    formData.append('face_frontal', fs.createReadStream(req.files.face_frontal[0].path), {
      filename: req.files.face_frontal[0].originalname,
      contentType: req.files.face_frontal[0].mimetype
    });
    formData.append('face_lateral', fs.createReadStream(req.files.face_lateral[0].path), {
      filename: req.files.face_lateral[0].originalname,
      contentType: req.files.face_lateral[0].mimetype
    });
    formData.append('hair', fs.createReadStream(req.files.hair[0].path), {
      filename: req.files.hair[0].originalname,
      contentType: req.files.hair[0].mimetype
    });
    formData.append('hand', fs.createReadStream(req.files.hand[0].path), {
      filename: req.files.hand[0].originalname,
      contentType: req.files.hand[0].mimetype
    });

    const response = await axios.post(`${AI_WORKER_URL}/api/v1/beauty-scan`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': req.header('Authorization')
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // Limpieza asíncrona de archivos temporales
    const pathsToUnlink = [
      req.files.face_frontal[0].path,
      req.files.face_lateral[0].path,
      req.files.hair[0].path,
      req.files.hand[0].path
    ];
    pathsToUnlink.forEach(filePath => {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`⚠️ Error limpiando archivo temporal ${filePath}:`, err.message);
      });
    });

    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error('❌ Error en el proxy /api/v1/beauty-scan:', error.message);
    if (req.files) {
      const allFiles = [
        req.files.face_frontal?.[0]?.path,
        req.files.face_lateral?.[0]?.path,
        req.files.hair?.[0]?.path,
        req.files.hand?.[0]?.path
      ];
      allFiles.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    return res.status(500).json({ error: 'Error procesando escaneo capilar/facial' });
  }
});

module.exports = { app, sseClients };
