import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Pago, PagoEstadoSync, PagoMetodo } from './pago.entity';
import { Factura, FacturaEstadoSync } from '../facturas/factura.entity';
import { ContabilidadPort } from '../contabilidad-adapter/contabilidad.port';
import { CreatePagoDto } from './dto/pago.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectRepository(Pago)
    private readonly pagosRepository: Repository<Pago>,
    @InjectQueue('contabilidad-sync')
    private readonly syncQueue: Queue,
    @Inject('CONTABILIDAD_PORT')
    private readonly contabilidadPort: ContabilidadPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWompiPayment(
    tenantId: string,
    dto: CreatePagoDto,
  ): Promise<Pago> {
    // Validate factura exists and belongs to tenant via event emitter query
    // We need to check factura exists - use direct query since we don't inject FacturaRepository
    const factura = await this.pagosRepository.manager.findOne(Factura, {
      where: { id: dto.factura_id, tenant_id: tenantId },
      relations: ['unidad'],
    });

    if (!factura) {
      throw new NotFoundException('Invoice not found');
    }

    // Validate amount doesn't exceed pending balance
    const pendingAmount = Number(factura.monto) - factura.total_pagado;
    if (dto.monto > pendingAmount + 0.01) { // Small tolerance
      throw new BadRequestException(
        `Payment amount (${dto.monto}) exceeds pending balance (${pendingAmount})`,
      );
    }

    // Create payment record
    const pago = this.pagosRepository.create({
      tenant_id: tenantId,
      factura_id: dto.factura_id,
      unidad_id: factura.unidad_id,
      monto: dto.monto,
      metodo_pago: PagoMetodo.WOMPI,
      wompi_transaction_id: dto.wompi_transaction_id,
      wompi_reference: dto.wompi_reference,
      estado_sync: PagoEstadoSync.PENDIENTE_SINCRONIZAR_SIIGO,
      metadata: {
        wompi_payment_link_id: dto.wompi_payment_link_id,
        ...dto.metadata,
      },
    });

    const saved = await this.pagosRepository.save(pago);

    // Queue for SIIGO sync
    await this.syncQueue.add('sync-pago', {
      pagoId: saved.id,
      tenantId,
    });

    // Emit event for factura status update
    this.eventEmitter.emit('pago.registrado', {
      facturaId: dto.factura_id,
      monto: dto.monto,
      tenantId,
      pagoId: saved.id,
    });

    this.logger.log(`Created Wompi payment ${saved.id} for factura ${dto.factura_id}`);
    return saved;
  }

  async createManualPayment(
    tenantId: string,
    dto: CreatePagoDto,
  ): Promise<Pago> {
    const factura = await this.pagosRepository.manager.findOne(Factura, {
      where: { id: dto.factura_id, tenant_id: tenantId },
    });

    if (!factura) {
      throw new NotFoundException('Invoice not found');
    }

    const metodoPago = (dto.metodo_pago as PagoMetodo) || PagoMetodo.EFECTIVO;

    const pago = this.pagosRepository.create({
      tenant_id: tenantId,
      factura_id: dto.factura_id,
      unidad_id: factura.unidad_id,
      monto: dto.monto,
      metodo_pago: metodoPago,
      wompi_transaction_id: dto.wompi_transaction_id,
      wompi_reference: dto.wompi_reference,
      estado_sync: PagoEstadoSync.PENDIENTE_SINCRONIZAR_SIIGO,
      metadata: dto.metadata,
    });

    const saved = await this.pagosRepository.save(pago);

    await this.syncQueue.add('sync-pago', {
      pagoId: saved.id,
      tenantId,
    });

    // Emit event for factura status update
    this.eventEmitter.emit('pago.registrado', {
      facturaId: dto.factura_id,
      monto: dto.monto,
      tenantId,
      pagoId: saved.id,
    });

    return saved;
  }

  async findById(id: string, tenantId: string): Promise<Pago> {
    const pago = await this.pagosRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['factura', 'unidad'],
    });

    if (!pago) {
      throw new NotFoundException('Payment not found');
    }

    return pago;
  }

  async findByTenant(tenantId: string, filters?: {
    unidad_id?: string;
    factura_id?: string;
    estado_sync?: PagoEstadoSync;
    metodo_pago?: PagoMetodo;
    fecha_desde?: Date;
    fecha_hasta?: Date;
  }): Promise<Pago[]> {
    const query = this.pagosRepository.createQueryBuilder('pago')
      .where('pago.tenant_id = :tenantId', { tenantId })
      .leftJoinAndSelect('pago.factura', 'factura')
      .leftJoinAndSelect('pago.unidad', 'unidad')
      .orderBy('pago.fecha', 'DESC');

    if (filters?.unidad_id) {
      query.andWhere('pago.unidad_id = :unidad_id', { unidad_id: filters.unidad_id });
    }

    if (filters?.factura_id) {
      query.andWhere('pago.factura_id = :factura_id', { factura_id: filters.factura_id });
    }

    if (filters?.estado_sync) {
      query.andWhere('pago.estado_sync = :estado_sync', { estado_sync: filters.estado_sync });
    }

    if (filters?.metodo_pago) {
      query.andWhere('pago.metodo_pago = :metodo_pago', { metodo_pago: filters.metodo_pago });
    }

    if (filters?.fecha_desde) {
      query.andWhere('pago.fecha >= :fecha_desde', { fecha_desde: filters.fecha_desde });
    }

    if (filters?.fecha_hasta) {
      query.andWhere('pago.fecha <= :fecha_hasta', { fecha_hasta: filters.fecha_hasta });
    }

    return query.getMany();
  }

  async getPaymentsByUnidad(tenantId: string, unidadId: string): Promise<Pago[]> {
    return this.findByTenant(tenantId, { unidad_id: unidadId });
  }

  async getPaymentsByFactura(facturaId: string, tenantId: string): Promise<Pago[]> {
    return this.pagosRepository.find({
      where: { factura_id: facturaId, tenant_id: tenantId },
      relations: ['factura', 'unidad'],
      order: { fecha: 'DESC' },
    });
  }

  async retrySync(id: string, tenantId: string): Promise<Pago> {
    const pago = await this.findById(id, tenantId);

    if (pago.estado_sync === PagoEstadoSync.SINCRONIZADO) {
      throw new BadRequestException('Payment already synchronized');
    }

    pago.intentos_sync += 1;
    pago.ultimo_intento_sync = new Date();
    pago.estado_sync = PagoEstadoSync.PENDIENTE_SINCRONIZAR_SIIGO;
    pago.error_sync = '';

    await this.pagosRepository.save(pago);

    await this.syncQueue.add('sync-pago', {
      pagoId: pago.id,
      tenantId,
    });

    return pago;
  }

  async updateSyncStatus(
    id: string,
    tenantId: string,
    estado: PagoEstadoSync,
    siigoId?: string,
    error?: string,
  ): Promise<Pago> {
    const pago = await this.findById(id, tenantId);

    pago.estado_sync = estado;
    if (siigoId) pago.siigo_pago_id = siigoId;
    if (error) pago.error_sync = error;

    if (estado === PagoEstadoSync.SINCRONIZADO) {
      // Emit event to update factura status
      this.eventEmitter.emit('pago.sincronizado', {
        facturaId: pago.factura_id,
        monto: Number(pago.monto),
        tenantId,
        pagoId: pago.id,
      });
    }

    return this.pagosRepository.save(pago);
  }
}