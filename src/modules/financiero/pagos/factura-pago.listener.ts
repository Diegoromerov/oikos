import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura, FacturaEstadoSync } from '../facturas/factura.entity';
import { PagoEstadoSync } from './pago.entity';

@Injectable()
export class FacturaPagoListener {
  constructor(
    @InjectRepository(Factura)
    private readonly facturasRepository: Repository<Factura>,
  ) {}

  @OnEvent('pago.registrado')
  async handlePagoRegistrado(payload: {
    facturaId: string;
    monto: number;
    tenantId: string;
    pagoId: string;
  }): Promise<void> {
    // Could trigger factura status check here if needed
    // For now, we just log - the actual status update happens on sync
    console.log(`[Event] Pago registrado: ${payload.pagoId} para factura ${payload.facturaId}`);
  }

  @OnEvent('pago.sincronizado')
  async handlePagoSincronizado(payload: {
    facturaId: string;
    monto: number;
    tenantId: string;
    pagoId: string;
  }): Promise<void> {
    // Check if factura is fully paid and update status
    const factura = await this.facturasRepository.findOne({
      where: { id: payload.facturaId, tenant_id: payload.tenantId },
    });

    if (!factura) {
      console.warn(`[Event] Factura ${payload.facturaId} not found for pago.sincronizado`);
      return;
    }

    // Sum all synchronized payments for this factura
    const totalPagado = await this.facturasRepository.manager
      .createQueryBuilder('pago', 'pagos')
      .select('COALESCE(SUM(pagos.monto), 0)', 'total')
      .where('pagos.factura_id = :facturaId', { facturaId: payload.facturaId })
      .andWhere('pagos.tenant_id = :tenantId', { tenantId: payload.tenantId })
      .andWhere('pagos.estado_sync = :sincronizado', { sincronizado: PagoEstadoSync.SINCRONIZADO })
      .getRawOne();

    if (Number(totalPagado.total) >= Number(factura.monto) - 0.01) {
      factura.estado_sync = FacturaEstadoSync.SINCRONIZADO;
      await this.facturasRepository.save(factura);
      console.log(`[Event] Factura ${payload.facturaId} marked as SINCRONIZADO`);
    }
  }
}