// backend/scratch/bundle_prompt.js
const fs = require('fs');
const path = require('path');

const screens = [
  { name: 'provider_dashboard_screen.dart', path: '../../frontend/lib/screens/provider_dashboard_screen.dart' },
  { name: 'provider_profile_screen.dart', path: '../../frontend/lib/screens/provider_profile_screen.dart' },
  { name: 'provider_services_screen.dart', path: '../../frontend/lib/screens/provider_services_screen.dart' },
  { name: 'provider_portfolio_screen.dart', path: '../../frontend/lib/screens/provider_portfolio_screen.dart' },
  { name: 'wallet_screen.dart', path: '../../frontend/lib/screens/wallet_screen.dart' }
];

const targetDir = 'C:\\Users\\Compu casa\\.gemini\\antigravity\\brain\\4af6a9bd-187e-4827-85cc-6e5628373009';
const targetFile = path.join(targetDir, 'auditoria_proveedor_prompt.md');

let promptContent = `# PROMPT: AUDITORÍA HEURÍSTICA Y EVALUACIÓN UX/UI - LADO PRESTADOR

Actúa como un Diseñador Lead de Producto UX/UI y Auditor Senior de Interfaces. Tu tarea es analizar de forma exhaustiva los componentes, arquitectura de información y coherencia visual del **Lado del Prestador (Proveedor)** de Belleza App / GlowApp basándote en el código Flutter proporcionado al final de este prompt.

Evalúa y reporta sobre los siguientes aspectos:
1. **Consistencia Visual y Jerarquía**: Uso de la paleta de colores premium (terracota, ocre, cremas), legibilidad de fuentes, uso de sombras y bordes redondeados.
2. **Usabilidad del Dashboard**: Organización de estadísticas rápidas, listado de citas hoy, alertas de SOS y navegación.
3. **Flujos de Gestión**: Interfaz de creación de servicios, carga de portafolio de fotos y retiros en la billetera virtual.
4. **Accesibilidad y Ergonomía (WCAG)**: Contraste, claridad en el estado vacío (*empty states*), y diálogos de confirmación.

Entrega un informe estructurado con una tabla de hallazgos clasificados en [CRÍTICO], [MEJORA] y [SUGERENCIA].

---
# CÓDIGO FUENTE DE LAS PANTALLAS DEL PRESTADOR
\n\n`;

for (const screen of screens) {
  const absPath = path.resolve(__dirname, screen.path);
  if (fs.existsSync(absPath)) {
    const code = fs.readFileSync(absPath, 'utf8');
    promptContent += `## Archivo: ${screen.name}\n\`\`\`dart\n${code}\n\`\`\`\n\n`;
    console.log(`✅ Agregado: ${screen.name}`);
  } else {
    console.warn(`⚠️ No encontrado: ${absPath}`);
  }
}

fs.writeFileSync(targetFile, promptContent, 'utf8');
console.log(`🎉 Prompt con código consolidado creado con éxito en: ${targetFile}`);
