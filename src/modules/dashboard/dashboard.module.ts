import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Factura } from '@modules/financiero/facturas/factura.entity';
import { Pago } from '@modules/financiero/pagos/pago.entity';
import { Pqrs } from '@modules/pqrs/pqrs.entity';
import { Reserva } from '@modules/reservas/reserva.entity';
import { Comunicado } from '@modules/comunicados/comunicado.entity';
import { ZonaComun } from '@modules/reservas/zona-comun.entity';
import { Unidad } from '@modules/unidades/unidad.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Factura,
      Pago,
      Pqrs,
      Reserva,
      Comunicado,
      ZonaComun,
      Unidad,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}