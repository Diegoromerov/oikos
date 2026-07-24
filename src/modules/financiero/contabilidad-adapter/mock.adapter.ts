import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContabilidadPort } from './contabilidad.port';
import { Factura, FacturaEstadoSync } from '@modules/financiero/facturas/factura.entity';
import { Pago, PagoEstadoSync } from '@modules/financiero/pagos/pago.entity';
import { Unidad } from '@modules/unidades/unidad.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MockAdapter implements ContabilidadPort {
  private readonly logger = new Logger(MockAdapter.name);
  
  // In-memory store for mock SIIGO data
  private mockSiigoFacturas: Map<string, { id: string; facturaId: string; syncedAt: Date }> = new Map();
  private mockSiigoPagos: Map<string, { id: string; pagoId: string; syncedAt: Date }> = new Map();
  
  // Mock state for facturas
  private facturaSyncState: Map<string, 'pendiente' | 'sincronizado' | 'error'> = new Map();

  constructor(
    @InjectRepository(Factura)
    private readonly facturasRepository: Repository<Factura>,
    @InjectRepository(Pago)
    private readonly pagosRepository: Repository<Pago>,
    @InjectRepository(Unidad)
    private readonly unidadesRepository: Repository<Unidad>,
  ) {}

  async registrarPago(pago: {
    id: string;
    facturaId: string;
    monto: number;
    metodo: string;
    wompiTransactionId?: string;
    fecha: Date;
    estadoSync: string;
    siigoPagoId?: string;
  }): Promise<{ siigoPagoId: string; success: boolean }> {
    this.logger.log(`[MOCK] Registrando pago ${pago.id} en SIIGO...`);
    
    // Simulate API call delay
    await this.delay(200);
    
    // Generate mock SIIGO payment ID
    const siigoPagoId = `MOCK-SIIGO-PAGO-${uuidv4().slice(0, 8).toUpperCase()}`;
    
    // Store mock record
    this.mockSiigoPagos.set(pago.id, {
      id: siigoPagoId,
      pagoId: pago.id,
      syncedAt: new Date(),
    });
    
    this.logger.log(`[MOCK] Pago registrado en SIIGO con ID: ${siigoPagoId}`);
    
    return { siigoPagoId, success: true };
  }

  async obtenerEstadoCuenta(unidadId: string, periodo?: string): Promise<{
    unidadId: string;
    periodo: string;
    facturasPendientes: Array<{
      id: string;
      tipo: 'ordinaria' | 'extraordinaria';
      periodo: string;
      monto: number;
      fechaEmision: Date;
      fechaVencimiento: Date;
      estadoSync: 'pendiente' | 'sincronizado' | 'error';
    }>;
    totalPendiente: number;
    totalPagado: number;
    saldo: number;
  }> {
    this.logger.log(`[MOCK] Obteniendo estado de cuenta para unidad ${unidadId}`);
    
    await this.delay(150);
    
    // Fetch real facturas from database
    const query = this.facturasRepository.createQueryBuilder('factura')
      .where('factura.unidad_id = :unidadId', { unidadId })
      .andWhere('factura.estado_sync != :pagada', { pagada: FacturaEstadoSync.SINCRONIZADO }); // Not fully paid
    
    if (periodo) {
      query.andWhere('factura.periodo = :periodo', { periodo });
    }
    
    const facturas = await query.getMany();
    
    // Fetch pagos for this unidad
    const pagos = await this.pagosRepository
      .createQueryBuilder('pago')
      .innerJoin('pago.factura', 'factura')
      .where('factura.unidad_id = :unidadId', { unidadId })
      .getMany();
    
    const facturasPendientes = facturas.map(f => ({
      id: f.id,
      tipo: (f.tipo === 'ordinaria' ? 'ordinaria' : 'extraordinaria') as 'ordinaria' | 'extraordinaria',
      periodo: f.periodo,
      monto: Number(f.monto),
      fechaEmision: f.fecha_emision,
      fechaVencimiento: f.fecha_vencimiento,
      estadoSync: (this.facturaSyncState.get(f.id) || f.estado_sync) as 'pendiente' | 'sincronizado' | 'error',
    }));
    
    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + f.monto, 0);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    
    return {
      unidadId,
      periodo: periodo || 'todos',
      facturasPendientes,
      totalPendiente,
      totalPagado,
      saldo: totalPendiente - totalPagado,
    };
  }

  async obtenerFacturasPendientes(unidadId: string): Promise<Array<{
    id: string;
    tipo: 'ordinaria' | 'extraordinaria';
    periodo: string;
    monto: number;
    fechaEmision: Date;
    fechaVencimiento: Date;
    estadoSync: 'pendiente' | 'sincronizado' | 'error';
  }>> {
    this.logger.log(`[MOCK] Obteniendo facturas pendientes para unidad ${unidadId}`);
    
    await this.delay(100);
    
    const facturas = await this.facturasRepository
      .createQueryBuilder('factura')
      .where('factura.unidad_id = :unidadId', { unidadId })
      .andWhere('factura.estado_sync IN (:...estados)', {
        estados: [FacturaEstadoSync.PENDIENTE, FacturaEstadoSync.ERROR],
      })
      .orderBy('factura.fecha_vencimiento', 'ASC')
      .getMany();
    
    return facturas.map(f => ({
      id: f.id,
      tipo: f.tipo === 'ordinaria' ? 'ordinaria' : 'extraordinaria' as const,
      periodo: f.periodo,
      monto: Number(f.monto),
      fechaEmision: f.fecha_emision,
      fechaVencimiento: f.fecha_vencimiento,
      estadoSync: this.facturaSyncState.get(f.id) || f.estado_sync,
    }));
  }

  async sincronizarFactura(facturaId: string): Promise<{ siigoFacturaId: string; success: boolean }> {
    this.logger.log(`[MOCK] Sincronizando factura ${facturaId} con SIIGO...`);
    
    await this.delay(300);
    
    const factura = await this.facturasRepository.findOne({ where: { id: facturaId } });
    if (!factura) {
      throw new Error(`Factura ${facturaId} no encontrada`);
    }
    
    // Simulate random success/failure for realistic testing
    // 90% success rate
    const success = Math.random() > 0.1;
    
    if (success) {
      const siigoFacturaId = `MOCK-SIIGO-FAC-${uuidv4().slice(0, 8).toUpperCase()}`;
      
      this.mockSiigoFacturas.set(facturaId, {
        id: siigoFacturaId,
        facturaId,
        syncedAt: new Date(),
      });
      
      this.facturaSyncState.set(facturaId, 'sincronizado');
      
      this.logger.log(`[MOCK] Factura sincronizada con SIIGO ID: ${siigoFacturaId}`);
      
      return { siigoFacturaId, success: true };
    } else {
      this.facturaSyncState.set(facturaId, 'error');
      const error = 'Error simulado de conexión con SIIGO API';
      this.logger.error(`[MOCK] Error sincronizando factura: ${error}`);
      
      throw new Error(error);
    }
  }

  async verificarEstadoSincronizacion(facturaId: string): Promise<{
    estado: 'pendiente' | 'sincronizado' | 'error';
    siigoId?: string;
  }> {
    await this.delay(50);
    
    const state = this.facturaSyncState.get(facturaId);
    const mockRecord = this.mockSiigoFacturas.get(facturaId);
    
    return {
      estado: state || 'pendiente',
      siigoId: mockRecord?.id,
    };
  }

  // Helper methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to reset mock state for testing
  resetMockState(): void {
    this.mockSiigoFacturas.clear();
    this.mockSiigoPagos.clear();
    this.facturaSyncState.clear();
    this.logger.log('[MOCK] Estado reiniciado');
  }

  // Method to get all mock records (for testing/debugging)
  getMockSiigoFacturas(): Map<string, any> {
    return new Map(this.mockSiigoFacturas);
  }

  getMockSiigoPagos(): Map<string, any> {
    return new Map(this.mockSiigoPagos);
  }
}