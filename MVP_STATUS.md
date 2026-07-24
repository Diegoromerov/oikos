# MVP Status — Oikos App Backend

**Última verificación:** 2025-07-23  
**Comando de verificación:** `npm run build && npm run test:integration`  
**Resultado:** ✅ Build limpio (0 errores) · 73 tests de integración PASS contra PostgreSQL real

---

## Resumen por Sprint

| Sprint | Módulos | Tablas | Tests | Comando verificación |
|--------|---------|--------|-------|---------------------|
| **Sprint 1** | Tenants, Usuarios, Unidades, Financiero | 7 | 19 | `npm run test:integration -- --testPathPattern="rls-isolation"` |
| **Sprint 2** | Portería | 5 | 26 | `npm run test:integration -- --testPathPattern="porteria"` |
| **Sprint 3** | PQRS + Reservas | 4 | 20 | `npm run test:integration -- --testPathPattern="pqrs-reservas"` |
| **Sprint 4** | Comunicados | 1 | 8 | `npm run test:integration -- --testPathPattern="comunicados"` |
| **Total** | **7 módulos funcionales** | **17 tablas RLS** | **73** | `npm run test:integration` |

---

## Detalle por Sprint

### Sprint 1 — Fundación Multi-tenant (19 tests)
**Módulos:** `tenants/`, `usuarios/`, `unidades/`, `financiero/`, `core/` (auth, tenancy, encryption)  
**Tablas:** `tenants`, `roles`, `usuarios`, `usuario_roles`, `unidades`, `usuario_unidades`, `facturas`, `pagos`, `sync_jobs`  
**Tests:** Aislamiento RLS por tenant (7 tablas), superadmin bypass, ataques cross-tenant (INSERT/UPDATE/DELETE → 0 rows)

### Sprint 2 — Portería Offline-First (26 tests)
**Módulo:** `porteria/`  
**Tablas:** `visitantes_preautorizados`, `registros_acceso`, `correspondencia`, `minutas_turno`, `incidentes`  
**Features:** QR JWT autocontenido (validación offline), sync idempotente por `local_uuid`, botón pánico (`prioridad_envio=true`)  
**Tests:** 5 tablas × RLS + 5 tests idempotencia `local_uuid` + cross-tenant attacks

### Sprint 3 — PQRS + Reservas (20 tests)
**Módulos:** `pqrs/`, `reservas/`  
**Tablas:** `pqrs`, `pqrs_seguimientos`, `zonas_comunes`, `reservas`  
**Features:** SLA auto-calculado por trigger (tipo×prioridad), state machine PQRS (trigger valida transiciones), exclusion constraint reservas no-solapamiento (GIST + btree_gist + GENERATED STORED columns)  
**Tests:** 4 tablas RLS + 3 state machine + 1 SLA + 1 concurrencia exclusion constraint

### Sprint 4 — Comunicados (8 tests)
**Módulo:** `comunicados/`  
**Tabla:** `comunicados`  
**Features:** Cartelera digital unidireccional (admin→residentes), prioridad visual (baja/normal/alta/urgente), fecha_expiracion opcional, solo vigentes para residentes  
**Tests:** RLS aislamiento + cross-tenant attacks + filtro vigentes + prioridad

---

## Lo que NO está implementado (alcance consciente)

| Área | Estado | Comentario |
|------|--------|------------|
| **Actas de asamblea/consejo** | ❌ No existe | Sin tabla, sin migración, sin endpoints |
| **Votación electrónica ponderada por coeficiente** | ❌ No existe | Requiere: tabla votos, ponderación por `unidades.coeficiente_copropiedad`, quorum, resultados |
| **Mantenimiento de activos** (ascensores, bombas, pólizas) | ❌ No existe | Sin tabla activos, sin calendario mantenimientos, sin alertas vencimiento |
| **Integración real SIIGO** | ⚠️ MockAdapter activo | `financiero/` usa `SiigoMockAdapter` (implementa `ContabilidadAdapter` Port). `SiigoAdapter` real pendiente: requiere definir producto (Nube vs Contabilidad), credenciales, mapeo facturas/pagos, webhooks. |

---

## Arquitectura RLS Verificada

- **Patrón único:** `app.current_tenant` + `app.is_superadmin` session variables
- **Template:** `create_rls_policies()` en migración 027, replicado en 028-032
- **FORCE ROW LEVEL SECURITY** en **todas** las 17 tablas de negocio
- **Usuario de tests:** `oikos_app` (non-owner) → RLS aplica efectivamente
- **Superadmin bypass:** `SET app.is_superadmin = 'true'` ve todo

---

## Comandos de Verificación

```bash
# Build limpio
npm run build
# → Exit 0, 0 errores TypeScript

# Tests completos (73 PASS)
npm run test:integration
# → Test Suites: 4 passed, Tests: 73 passed

# Por sprint individual
npm run test:integration -- --testPathPattern="rls-isolation"      # Sprint 1: 19
npm run test:integration -- --testPathPattern="porteria"           # Sprint 2: 26
npm run test:integration -- --testPathPattern="pqrs-reservas"      # Sprint 3: 20
npm run test:integration -- --testPathPattern="comunicados"        # Sprint 4: 8
```

---

## Estructura del Proyecto (src/modules/)

```
src/modules/
├── core/              # auth (JwtAuthGuard, RolesGuard), tenancy (TenantGuard, RLS context), encryption
├── tenants/           # CRUD tenants + siigo_config encryption
├── usuarios/          # users, roles N:M, user-unidades N:M
├── unidades/          # censo, coeficiente NUMERIC(10,8), CSV bulk, validation job
├── financiero/        # facturas, pagos, contabilidad-adapter (Port + MockAdapter + BullMQ worker)
├── porteria/          # 5 entidades, sync idempotente local_uuid, QR JWT offline, panic button
├── pqrs/              # PQRS + seguimientos, SLA trigger, state machine trigger
├── reservas/          # zonas_comunes + reservas, exclusion constraint no-overlap (GIST)
└── comunicados/       # cartelera digital, prioridad, fecha_expiracion, solo vigentes para residentes
```

**Archivos legacy aislados:** `_legacy/admin-glow/`, `_legacy/tiktok-trends/` (fuera de compilación, no importados en `app.module.ts`)

---

## Migraciones Propias (027-032)

| # | Archivo | Tablas |
|---|---------|--------|
| 027 | `027_tenants_rls_template.sql` | `tenants` + funciones RLS template |
| 028 | `028_usuarios_unidades_rls.sql` | `roles`, `usuarios`, `usuario_roles`, `unidades`, `usuario_unidades` |
| 029 | `029_financiero_facturas_pagos_rls.sql` | `facturas`, `pagos`, `sync_jobs` |
| 030 | `030_porteria_rls.sql` | `visitantes_preautorizados`, `registros_acceso`, `correspondencia`, `minutas_turno`, `incidentes` |
| 031 | `031_pqrs_reservas_rls.sql` | `pqrs`, `pqrs_seguimientos`, `zonas_comunes`, `reservas` (+ exclusion constraint) |
| 032 | `032_comunicados_rls.sql` | `comunicados` |

---

## Estado Final MVP

**✅ COMPLETO — Listo para despliegue piloto (220 aptos)**

- 7 módulos funcionales cubriendo: multi-tenancy, usuarios/unidades, facturación, portería (offline-first), PQRS con SLA, reservas con no-overlap DB-level, comunicados
- 73 tests de integración reales contra PostgreSQL con usuario non-owner
- Build limpio, RLS forzado en 17 tablas
- Código legacy aislado, sin riesgo de compilación accidental

**Próximos pasos naturales (fuera de MVP):**
1. Actas + Votación (requiere diseño ponderación por coeficiente)
2. Mantenimiento activos (calendario, alertas, proveedores)
3. SiigoAdapter real (definir producto Nube/Contabilidad, mapeo, webhooks)
4. Frontend Flutter (portería offline-first, residente, admin)