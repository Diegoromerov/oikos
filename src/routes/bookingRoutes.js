// backend/src/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const pilaCheck = require('../middleware/pilaCheck');
const bookingController = require('../controllers/bookingController');

// 🔹 CREAR RESERVA
router.post('/bookings', authMiddleware, bookingController.createBooking);

// 🔹 PANEL DE PRESTADOR: OBTENER CITAS
router.get('/bookings/provider', authMiddleware, pilaCheck, bookingController.getProviderBookings);

// 🔹 HISTORIAL DE CITAS DEL CLIENTE
router.get('/bookings/client', authMiddleware, bookingController.getClientBookings);

// 🔹 ACTUALIZAR ESTADO DE CITA
router.patch('/bookings/:id/status', authMiddleware, pilaCheck, bookingController.updateBookingStatus);

// 🔹 CANCELAR CITA
router.patch('/bookings/:id/cancel', authMiddleware, bookingController.cancelBooking);

// 🔹 SIMULAR PAGO CON WOMPI
router.post('/bookings/:id/pay', authMiddleware, bookingController.payBooking);

// 🔹 WEBHOOK SIMULADO DE WOMPI
router.post('/payments/wompi-webhook', bookingController.wompiWebhook);

// 🔹 CREAR RESEÑA
router.post('/bookings/:id/review', authMiddleware, bookingController.createReview);

// 🔹 INICIAR SERVICIO
router.patch('/bookings/:id/start', authMiddleware, pilaCheck, bookingController.startService);

module.exports = router;

