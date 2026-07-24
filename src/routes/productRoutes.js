// backend/src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const openBeautyFacts = require('../services/openBeautyFacts');
const profileService = require('../services/biometric/profile.service');

// Obtener catálogo de productos (soporta filtros por tag de especialidad)
router.get('/products', productController.getProducts);

// Obtener un producto por ID
router.get('/products/:id', productController.getProductById);

// Cargar un producto (Administrador)
router.post('/admin/products', authMiddleware, productController.createProduct);

// Actualizar un producto (Administrador)
router.put('/admin/products/:id', authMiddleware, productController.updateProduct);

// Eliminar un producto (Administrador)
router.delete('/admin/products/:id', authMiddleware, productController.deleteProduct);

// --- Rutas de Pedidos de GlowStore ---
router.post('/store/checkout', authMiddleware, orderController.createOrder);
router.get('/store/orders', authMiddleware, orderController.getOrders);
router.get('/store/orders/:id', authMiddleware, orderController.getOrderById);

// POST /api/biometric/check
router.post('/biometric/check', authMiddleware, async (req, res) => {
  const { userId, barcode } = req.body;

  if (!userId || !barcode) {
    return res.status(400).json({
      error: 'userId y barcode son obligatorios'
    });
  }

  try {
    const product = await openBeautyFacts.searchByBarcode(barcode);
    if (!product) {
      return res.status(404).json({
        error: 'Producto no encontrado en la base de datos de Open Beauty Facts'
      });
    }

    const profile = await profileService.getProfile(userId);
    let compatible = false;
    let reason = '';

    if (profile) {
      const ingredients = (product.ingredients || '').toLowerCase();
      const faceScores = profile.faceScores || {};

      if (faceScores.hydration < 50 && ingredients.includes('ácido hialurónico')) {
        compatible = true;
        reason = 'Este producto contiene ácido hialurónico, ideal para tu piel deshidratada.';
      } else if (faceScores.spots > 60 && (ingredients.includes('vitamina c') || ingredients.includes('niacinamida'))) {
        compatible = true;
        reason = 'Contiene vitamina C o niacinamida, que ayudan a reducir manchas faciales.';
      } else if (faceScores.wrinkles > 50 && ingredients.includes('retinol')) {
        compatible = true;
        reason = 'El retinol es excelente para tratar tus líneas de expresión y arrugas.';
      } else {
        compatible = false;
        reason = 'Este producto no parece alinearse con las necesidades específicas de tu piel en este momento.';
      }
    } else {
      reason = 'No tenemos tu perfil biométrico. Escanea tu piel para obtener recomendaciones personalizadas.';
    }

    res.json({
      success: true,
      product: {
        ...product,
        compatible,
        compatibilityReason: reason,
      }
    });
  } catch (error) {
    console.error('Error en /biometric/check:', error);
    res.status(500).json({
      error: 'Error al verificar el producto'
    });
  }
});

// GET /api/biometric/recommended/:userId
router.get('/biometric/recommended/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const profile = await profileService.getProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil biométrico no encontrado' });
    }

    const keyIngredients = profile.keyIngredients || [];
    if (keyIngredients.length === 0) {
      return res.json({ products: [] });
    }

    const products = await openBeautyFacts.getRecommendedProducts(keyIngredients, 5);
    res.json({ products });
  } catch (error) {
    console.error('Error en /biometric/recommended:', error);
    res.status(500).json({ error: 'Error al obtener productos recomendados' });
  }
});

module.exports = router;
