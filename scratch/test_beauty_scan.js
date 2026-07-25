// backend/scratch/test_beauty_scan.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'beauty_app_super_secret_key_2026_change_in_production';
const BASE_URL = 'http://localhost:3001';

// 1. Generar token JWT para el usuario demo (ID 1)
const token = jwt.sign(
  { id: 1, email: 'cliente.demo@bellezaapp.com', rol: 'CLIENTE' },
  JWT_SECRET
);

async function testScan() {
  console.log('🏁 Iniciando pruebas de integración del Beauty Intelligence Engine...');
  console.log('🔑 Token JWT generado:', token.substring(0, 20) + '...');

  // Crear buffers de imágenes ficticias
  const dummyBuffer = Buffer.from('fake image data for testing');
  
  const formData = new FormData();
  formData.append('user_id', '1');
  formData.append('face_frontal', dummyBuffer, { filename: 'face_frontal.jpg', contentType: 'image/jpeg' });
  formData.append('face_lateral', dummyBuffer, { filename: 'face_lateral.jpg', contentType: 'image/jpeg' });
  formData.append('hair', dummyBuffer, { filename: 'hair.jpg', contentType: 'image/jpeg' });
  formData.append('hand', dummyBuffer, { filename: 'hand.jpg', contentType: 'image/jpeg' });

  try {
    // 2. Ejecutar escaneo completo (llamada al proxy)
    console.log('\n📤 Enviando 4 imágenes al endpoint de escaneo unificado...');
    const scanResponse = await axios.post(`${BASE_URL}/api/v1/beauty-scan`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Respuesta de escaneo exitosa!');
    console.log(JSON.stringify(scanResponse.data, null, 2));

    // 3. Obtener el perfil unificado persistido en la base de datos
    console.log('\n📥 Consultando el Beauty Profile consolidado...');
    const profileResponse = await axios.get(`${BASE_URL}/api/v1/beauty-profile/1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Perfil beauty recuperado con éxito!');
    console.log(JSON.stringify(profileResponse.data, null, 2));

    // 4. Probar el endpoint de reprocesamiento
    console.log('\n🔄 Probando reprocesamiento de perfil...');
    const reprocessForm = new FormData();
    reprocessForm.append('user_id', '1');
    const reprocessResponse = await axios.post(`${BASE_URL}/api/v1/beauty-scan/reprocess`, reprocessForm, {
      headers: {
        ...reprocessForm.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Reprocesamiento exitoso!');
    console.log(JSON.stringify(reprocessResponse.data, null, 2));

    console.log('\n🎉 Todas las pruebas del motor de inteligencia de belleza pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error ejecutando las pruebas:', error.message);
    if (error.response) {
      console.error('Detalles del error del servidor:', error.response.status, error.response.data);
    }
  }
}

testScan();
