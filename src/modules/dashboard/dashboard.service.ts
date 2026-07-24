import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { Factura } from '@modules/financiero/facturas/factura.entity';
import { Pago } from '@modules/financiero/pagos/pago.entity';
import { Pqrs } from '@modules/pqrs/pqrs.entity';
import { Reserva } from '@modules/reservas/reserva.entity';
import { Comunicado } from '@modules/comunicados/comunicado.entity';
import { ZonaComun } from '@modules/reservas/zona-comun.entity';
import { Unidad } from '@modules/unidades/unidad.entity';

export interface DashboardStats {
  cartera: {
    pendiente_mes_actual: number;
    recaudado_mes_actual: number;
  };
  pqrs: {
    abiertos: number;
    vencidos_sla: number;
  };
  reservas_proximas: Array<{
    id: string;
    zona_comun_nombre: string;
    fecha: string;
    hora_inicio: string;
    unidad: { id: string; torre: string; numero: string } | null;
  }>;
  comunicados_recientes: Array<{
    id: string;
    titulo: string;
    tipo: string;
    fecha_publicacion: string;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Pqrs)
    private readonly pqrsRepo: Repository<Pqrs>,
    @InjectRepository(Reserva)
    private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(Comunicado)
    private readonly comunicadoRepo: Repository<Comunicado>,
    @InjectRepository(ZonaComun)
    private readonly zonaComunRepo: Repository<ZonaComun>,
    @InjectRepository(Unidad)
    private readonly unidadRepo: Repository<Unidad>,
  ) {}

  async getStats(tenantId: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Cartera: facturas pendientes y pagos del mes actual
    const [facturasPendientes, pagosMes] = await Promise.all([
      this.facturaRepo
        .createQueryBuilder('f')
        .select('SUM(f.monto - COALESCE(f.valor_pagado, 0))', 'total')
        .where('f.tenant_id = :tenantId', { tenantId })
        .andWhere('f.estado IN (:...estados)', { estados: ['pendiente', 'parcial', 'vencida'] })
        .getRawOne(),
      this.pagoRepo
        .createQueryBuilder('p')
        .select('SUM(p.monto)', 'total')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.fecha_pago BETWEEN :start AND :end', { start: startOfMonth, end: endOfMonth })
        .andWhere('p.estado = :estado', { estado: 'confirmado' })
        .getRawOne(),
    ]);

    // PQRS: abiertos y vencidos
    const [pqrsAbiertos, pqrsVencidos] = await Promise.all([
      this.pqrsRepo
        .createQueryBuilder('p')
        .select('COUNT(*)', 'count')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.estado IN (:...estados)', { estados: ['abierto', 'en_proceso'] })
        .getRawOne(),
      this.pqrsRepo
        .createQueryBuilder('p')
        .select('COUNT(*)', 'count')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.sla_fecha_limite < :now', { now })
        .andWhere('p.fecha_resolucion IS NULL')
        .andWhere('p.estado NOT IN (:...estadosFinales)', { estadosFinales: ['resuelto', 'cerrado', 'rechazado'] })
        .getRawOne(),
    ]);

    // Próximas 5 reservas confirmadas
    const reservasProximas = await this.reservaRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.zonaComun', 'zc')
      .leftJoinAndSelect('r.unidad', 'u')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.estado = :estado', { estado: 'confirmada' })
      .andWhere('r.fecha >= :today', { today: now.toISOString().split('T')[0] })
      .orderBy('r.fecha', 'ASC')
      .addOrderBy('r.horaInicio', 'ASC')
      .limit(5)
      .getMany();

    // Últimos 3 comunicados activos no expirados
    const comunicadosRecientes = await this.comunicadoRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.unidad', 'u')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.activo = :activo', { activo: true })
      .andWhere('(c.fecha_expiracion IS NULL OR c.fecha_expiracion >= :now)', { now })
      .orderBy('c.fechaPublicacion', 'DESC')
      .limit(3)
      .getMany();

    return {
      cartera: {
        pendiente_mes_actual: Number(facturasPendientes?.total) || 0,
        recaudado_mes_actual: Number(pagosMes?.total) || 0,
      },
      pqrs: {
        abiertos: Number(pqrsAbiertos?.count) || 0,
        vencidos_sla: Number(pqrsVencidos?.count) || 0,
      },
      reservas_proximas: reservasProximas.map((r) => ({
        id: r.id,
        zona_comun_nombre: r.zonaComun?.nombre || '',
        fecha: r.fecha.toISOString().split('T')[0],
        hora_inicio: r.horaInicio,
        unidad: r.unidad ? { id: r.unidad.id, torre: r.unidad.torre, numero: r.unidad.numero } : null,
      })),
      comunicados_recientes: comunicadosRecientes.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        tipo: c.tipo,
        fecha_publicacion: c.fechaPublicacion.toISOString(),
      })),
    };
  }
}