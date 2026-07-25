export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  foto_url?: string;
  activo: boolean;
  email_verificado: boolean;
  ultimo_acceso?: string;
  creado_en: string;
  actualizado_en: string;
  roles?: UserRole[];
}

export interface Role {
  id: string;
  nombre: string;
  tipo: 'propietario' | 'residente' | 'portero' | 'admin' | 'junta' | 'revisor_fiscal' | 'superadmin';
  descripcion?: string;
  tenant_id?: string;
  es_global: boolean;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface UserRole {
  id: string;
  usuario_id: string;
  role_id: string;
  tenant_id: string;
  asignado_por?: string;
  creado_en: string;
}

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  email_contacto: string;
  telefono_contacto?: string;
  direccion?: string;
  tipo: 'conjunto_residencial' | 'conjunto_comercial' | 'mixto';
  total_unidades: number;
  coeficiente_total: number;
  siigo_config?: Record<string, unknown>;
  fecha_corte_migracion?: string;
  activo: boolean;
  configuracion?: Record<string, unknown>;
  creado_en: string;
  actualizado_en: string;
}

export interface Unidad {
  id: string;
  tenant_id: string;
  torre: string;
  bloque?: string;
  numero: string;
  tipo_unidad: 'apartamento' | 'parqueadero' | 'deposito' | 'local';
  area_privada: number;
  coeficiente_copropiedad: number;
  cuota_base: number;
  piso?: number;
  es_estudio: boolean;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  usuarios?: UsuarioUnidad[];
}

export interface UsuarioUnidad {
  id: string;
  usuario_id: string;
  unidad_id: string;
  tipo_relacion: 'propietario' | 'arrendatario' | 'residente_autorizado';
  es_principal: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Factura {
  id: string;
  tenant_id: string;
  unidad_id: string;
  periodo: string;
  valor_total: number;
  valor_cuota: number;
  valor_intereses: number;
  valor_multas: number;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'anulada' | 'vencida';
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_pago?: string;
  siigo_id?: string;
  siigo_sincronizado: boolean;
  siigo_error?: string;
  creado_en: string;
  actualizado_en: string;
  unidad?: Unidad;
}

export interface Pago {
  id: string;
  tenant_id: string;
  factura_id?: string;
  unidad_id: string;
  usuario_id: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro';
  referencia?: string;
  estado: 'pendiente' | 'confirmado' | 'rechazado' | 'devuelto';
  fecha_pago: string;
  confirmado_por?: string;
  fecha_confirmacion?: string;
  creado_en: string;
  actualizado_en: string;
  factura?: Factura;
  unidad?: Unidad;
}

export interface SincronizacionContable {
  id: string;
  tenant_id: string;
  tipo_entidad: 'factura' | 'pago' | 'unidad' | 'usuario';
  entidad_id: string;
  accion: 'crear' | 'actualizar' | 'eliminar';
  estado: 'pendiente' | 'procesando' | 'sincronizado' | 'error';
  payload?: Record<string, unknown>;
  respuesta?: Record<string, unknown>;
  intentos: number;
  ultimo_intento?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface VisitantePreautorizado {
  id: string;
  tenant_id: string;
  local_uuid: string;
  unidad_id: string;
  autorizado_por_id: string;
  nombre_visitante: string;
  documento_visitante: string;
  tipo_visitante: 'visitante' | 'domicilio' | 'servicio' | 'proveedor' | 'familiar';
  qr_code: string;
  valido_desde: string;
  valido_hasta: string;
  cancelado_en?: string;
  creado_en: string;
  actualizado_en: string;
  unidad?: Unidad;
}

export interface RegistroAcceso {
  id: string;
  tenant_id: string;
  local_uuid: string;
  unidad_id: string;
  visitante_preautorizado_id?: string;
  tipo_acceso: 'peatonal' | 'vehicular';
  direccion: 'entrada' | 'salida';
  portero_id: string;
  timestamp_local: string;
  sincronizado_en?: string;
  creado_en: string;
  actualizado_en: string;
  unidad?: Unidad;
  visitante?: VisitantePreautorizado;
}

export interface Correspondencia {
  id: string;
  tenant_id: string;
  local_uuid: string;
  unidad_id: string;
  tipo: 'paquete' | 'carta' | 'documento' | 'otro';
  portero_receptor_id: string;
  recibido_en: string;
  entregado_en?: string;
  entregado_a_id?: string;
  firma_digital?: string;
  observaciones?: string;
  creado_en: string;
  actualizado_en: string;
  unidad?: Unidad;
}

export interface MinutaTurno {
  id: string;
  tenant_id: string;
  local_uuid: string;
  portero_id: string;
  turno_inicio: string;
  turno_fin: string;
  novedades?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Incidente {
  id: string;
  tenant_id: string;
  local_uuid: string;
  portero_id: string;
  tipo_incidente: 'incidente' | 'panico' | 'emergencia_medica' | 'incendio' | 'seguridad' | 'otro';
  descripcion: string;
  prioridad_envio: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface PQRS {
  id: string;
  tenant_id: string;
  unidad_id: string;
  usuario_id: string;
  tipo: 'peticion' | 'queja' | 'reclamo' | 'sugerencia';
  asunto: string;
  descripcion: string;
  estado: 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado' | 'rechazado' | 'reabierto';
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  asignado_a?: string;
  sla_fecha_limite: string;
  fecha_resolucion?: string;
  archivos_adjuntos?: Record<string, unknown>[];
  creado_en: string;
  actualizado_en: string;
  unidad?: Unidad;
  usuario?: User;
  asignado?: User;
  seguimientos?: PQRSSeguimiento[];
}

export interface PQRSSeguimiento {
  id: string;
  tenant_id: string;
  pqrs_id: string;
  usuario_id: string;
  comentario: string;
  es_interno: boolean;
  creado_en: string;
  usuario?: User;
}

export interface ZonaComun {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion?: string;
  capacidad_maxima: number;
  costo: number;
  requiere_aprobacion: boolean;
  horario_disponible: Record<string, { inicio: string; fin: string }[]>;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface Reserva {
  id: string;
  tenant_id: string;
  zona_comun_id: string;
  unidad_id: string;
  usuario_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  costo_aplicado: number;
  estado: 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada';
  aprobado_por?: string;
  fecha_aprobacion?: string;
  observaciones?: string;
  creado_en: string;
  actualizado_en: string;
  zona_comun?: ZonaComun;
  unidad?: Unidad;
  usuario?: User;
}

export interface Comunicado {
  id: string;
  tenant_id: string;
  usuario_id: string;
  titulo: string;
  cuerpo: string;
  tipo: 'informativo' | 'urgente' | 'evento' | 'mantenimiento_programado';
  fecha_publicacion: string;
  fecha_expiracion?: string;
  adjuntos?: { nombre: string; url: string; tipo: string }[];
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  usuario?: User;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface DashboardStats {
  cartera: {
    pendiente: number;
    recaudada: number;
    porcentaje: number;
  };
  pqrs: {
    abiertos: number;
    vencidos: number;
    total: number;
  };
  reservas: {
    proximas: number;
    pendientes: number;
    total: number;
  };
  comunicados: {
    activos: number;
    total: number;
  };
  incidentes: {
    recientes: number;
    panico: number;
  };
}