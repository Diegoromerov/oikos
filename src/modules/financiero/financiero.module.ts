import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { FacturasModule } from './facturas/facturas.module';
import { PagosModule } from './pagos/pagos.module';
import { ContabilidadAdapterModule } from './contabilidad-adapter/contabilidad-adapter.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'contabilidad-sync' }),
    FacturasModule,
    PagosModule,
    ContabilidadAdapterModule,
  ],
  exports: [ContabilidadAdapterModule, FacturasModule, PagosModule],
})
export class FinancieroModule {}