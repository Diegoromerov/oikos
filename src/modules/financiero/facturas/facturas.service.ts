import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Factura, FacturaTipo, FacturaEstadoSync } from './factura.entity';
import { Unidad } from '../../unidades/unidad.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { ContabilidadPort, EstadoCuenta, FacturaPendiente } from '../contabilidad-adapter/contabilidad.port';
import { CreateFacturaDto } from './dto/factura.dto';

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    @InjectRepository(Factura)
    private readonly facturasRepository: Repository<Factura>,
    @InjectRepository(Unidad)
    private readonly unidadesRepository: Repository<Unidad>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectQueue('contabilidad-sync')
    private readonly syncQueue: Queue,
    @Inject('CONTABILIDAD_PORT')
    private readonly contabilidadPort: ContabilidadPort,
  ) {}

  async generateMonthlyOrdinaryInvoices(
    tenantId: string,
    periodo: string, // YYYY-MM
  ): Promise<Factura[]> {
    this.logger.log(`Generating monthly ordinary invoices for tenant ${tenantId}, period ${periodo}`);

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new BadRequestException('Periodo must be in YYYY-MM format');
    }

    // Get active units with base fee > 0
    const unidades = await this.unidadesRepository.find({
      where: {
        tenant_id: tenantId,
        activo: true,
        cuota_base: { $gt: 0 } as any,
      },
    });

    if (unidades.length === 0) {
      this.logger.warn(`No active units with base fee for tenant ${tenantId}`);
      return [];
    }

    // Calculate dates
    const [year, month] = periodo.split('-').map(Number);
    const fechaEmision = new Date(year, month - 1, 1);
    const fechaVencimiento = new Date(year, month, 1); // First of next month
    fechaVencimiento.setDate(fechaVencimiento.getDate() - 1); // Last day of current month

    const results: Factura[] = [];
    const errors: string[] = [];

    for (const unidad of unidades) {
      try {
        // Check if invoice already exists for this period
        const existing = await this.facturasRepository.findOne({
          where: {
            tenant_id: tenantId,
            unidad_id: unidad.id,
            periodo,
            tipo: FacturaTipo.ORDINARIA,
          },
        });

        if (existing) {
          errors.push(`Unit ${unidad.identificador}: Invoice already exists for ${periodo}`);
          continue;
        }

        // Create invoice
        const factura = this.facturasRepository.create({
          tenant_id: tenantId,
          unidad_id: unidad.id,
          tipo: FacturaTipo.ORDINARIA,
          periodo,
          monto: unidad.cuota_base,
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento,
          estado_sync: FacturaEstadoSync.PENDIENTE,
        });

        const saved = await this.facturasRepository.save(factura);
        results.push(saved);

        // Queue for SIIGO sync
        await this.syncQueue.add('sync-factura', {
          facturaId: saved.id,
          tenantId,
        });

      } catch (error) {
        errors.push(`Unit ${unidad.identificador}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Generation completed with ${errors.length} errors: ${errors.join('; ')}`);
    }

    this.logger.log(`Generated ${results.length} ordinary invoices for period ${periodo}`);
    return results;
  }

  async createExtraordinaryInvoice(
    tenantId: string,
    dto: CreateFacturaDto,
  ): Promise<Factura> {
    // Validate unit belongs to tenant
    const unidad = await this.unidadesRepository.findOne({
      where: { id: dto.unidad_id, tenant_id: tenantId },
    });

    if (!unidad) {
      throw new NotFoundException('Unit not found or does not belong to tenant');
    }

    // Check for duplicate
    const existing = await this.facturasRepository.findOne({
      where: {
        tenant_id: tenantId,
        unidad_id: dto.unidad_id,
        periodo: dto.periodo,
        tipo: FacturaTipo.EXTRAORDINARIA,
      },
    });

    if (existing) {
      throw new BadRequestException('Extraordinary invoice already exists for this unit and period');
    }

    const factura = this.facturasRepository.create({
      tenant_id: tenantId,
      unidad_id: dto.unidad_id,
      tipo: FacturaTipo.EXTRAORDINARIA,
      periodo: dto.periodo,
      monto: dto.monto,
      fecha_emision: dto.fecha_emision || new Date(),
      fecha_vencimiento: dto.fecha_vencimiento,
      estado_sync: FacturaEstadoSync.PENDIENTE,
    });

    const saved = await this.facturasRepository.save(factura);

    // Queue for sync
    await this.syncQueue.add('sync-factura', {
      facturaId: saved.id,
      tenantId,
    });

    return saved;
  }

  async findById(id: string, tenantId: string): Promise<Factura> {
    const factura = await this.facturasRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['unidad', 'pagos'],
    });

    if (!factura) {
      throw new NotFoundException('Invoice not found');
    }

    return factura;
  }

  async findByTenant(tenantId: string, filters?: {
    unidad_id?: string;
    periodo?: string;
    tipo?: FacturaTipo;
    estado_sync?: FacturaEstadoSync;
    vencidas?: boolean;
  }): Promise<Factura[]> {
    const query = this.facturasRepository.createQueryBuilder('factura')
      .where('factura.tenant_id = :tenantId', { tenantId })
      .leftJoinAndSelect('factura.unidad', 'unidad')
      .leftJoinAndSelect('factura.pagos', 'pagos')
      .orderBy('factura.fecha_vencimiento', 'ASC');

    if (filters?.unidad_id) {
      query.andWhere('factura.unidad_id = :unidadId', { unidadId: filters.unidad_id });
    }

    if (filters?.periodo) {
      query.andWhere('factura.periodo = :periodo', { periodo: filters.periodo });
    }

    if (filters?.tipo) {
      query.andWhere('factura.tipo = :tipo', { tipo: filters.tipo });
    }

    if (filters?.estado_sync) {
      query.andWhere('factura.estado_sync = :estado', { estado: filters.estado_sync });
    }

    if (filters?.vencidas) {
      query.andWhere('factura.fecha_vencimiento < :now', { now: new Date() })
        .andWhere('factura.estado_sync != :pagada', { pagada: FacturaEstadoSync.SINCRONIZADO });
    }

    return query.getMany();
  }

  async getEstadoCuenta(
    tenantId: string,
    unidadId: string,
  ): Promise<EstadoCuenta> {
    // Use the contabilidad port to get account state
    return this.contabilidadPort.obtenerEstadoCuenta(unidadId);
  }

  async getFacturasPendientes(
    tenantId: string,
    unidadId: string,
  ): Promise<FacturaPendiente[]> {
    return this.contabilidadPort.obtenerFacturasPendientes(unidadId);
  }

  async retrySync(facturaId: string, tenantId: string): Promise<Factura> {
    const factura = await this.findById(facturaId, tenantId);

    if (factura.estado_sync === FacturaEstadoSync.SINCRONIZADO) {
      throw new BadRequestException('Invoice already synchronized');
    }

    factura.intentos_sync += 1;
    factura.ultimo_intento_sync = new Date();
    factura.estado_sync = FacturaEstadoSync.PENDIENTE;

    await this.facturasRepository.save(factura);

    // Queue for sync
    await this.syncQueue.add('sync-factura', {
      facturaId: factura.id,
      tenantId,
    });

    return factura;
  }

  async updateSyncStatus(
    facturaId: string,
    tenantId: string,
    estado: FacturaEstadoSync,
    siigoId?: string,
    error?: string,
  ): Promise<Factura> {
    const factura = await this.findById(facturaId, tenantId);

    factura.estado_sync = estado;
    if (siigoId) factura.siigo_factura_id = siigoId;
    if (error) factura.error_sync = error;

    return this.facturasRepository.save(factura);
  }
}