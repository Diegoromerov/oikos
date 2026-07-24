import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MockAdapter } from './contabilidad-adapter/mock.adapter';
import { ContabilidadAdapter } from './contabilidad-adapter/contabilidad.adapter';
import { Factura } from './facturas/factura.entity';
import { Pago } from './pagos/pago.entity';
import { FacturasModule } from './facturas/facturas.module';
import { PagosModule } from './pagos/pagos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, Pago]),
    FacturasModule,
    PagosModule,
    BullModule.registerQueue(
      { name: 'contabilidad-sync' },
    ),
  ],
  providers: [
    MockAdapter,
    ContabilidadAdapter,
    {
      provide: 'CONTABILIDAD_PORT',
      useExisting: ContabilidadAdapter,
    },
  ],
  exports: ['CONTABILIDAD_PORT', FacturasModule, PagosModule],
})
export class FinancieroModule {}