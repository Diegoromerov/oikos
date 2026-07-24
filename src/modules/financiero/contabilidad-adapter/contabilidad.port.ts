export interface FacturaPendiente {
  id: string;
  tipo: 'ordinaria' | 'extraordinaria';
  periodo: string; // YYYY-MM
  monto: number;
  fechaEmision: Date;
  fechaVencimiento: Date;
  estadoSync: 'pendiente' | 'sincronizado' | 'error';
}

export interface EstadoCuenta {
  unidadId: string;
  periodo: string;
  facturasPendientes: FacturaPendiente[];
  totalPendiente: number;
  totalPagado: number;
  saldo: number;
}

export interface PagoRegistrado {
  id: string;
  facturaId: string;
  monto: number;
  metodo: string;
  wompiTransactionId?: string;
  fecha: Date;
  estadoSync: 'pendiente_de_sincronizar_siigo' | 'sincronizado' | 'error';
  siigoPagoId?: string;
}

export interface ContabilidadPort {
  // Registrar un pago en el sistema contable externo (SIIGO)
  registrarPago(pago: PagoRegistrado): Promise<{ siigoPagoId: string; success: boolean }>;
  
  // Obtener estado de cuenta de una unidad
  obtenerEstadoCuenta(unidadId: string, periodo?: string): Promise<EstadoCuenta>;
  
  // Obtener facturas pendientes de una unidad
  obtenerFacturasPendientes(unidadId: string): Promise<FacturaPendiente[]>;
  
  // Sincronizar factura con SIIGO
  sincronizarFactura(facturaId: string): Promise<{ siigoFacturaId: string; success: boolean }>;
  
  // Verificar estado de sincronización
  verificarEstadoSincronizacion(facturaId: string): Promise<{ estado: 'pendiente' | 'sincronizado' | 'error'; siigoId?: string }>;
}