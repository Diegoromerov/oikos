import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { MockAdapter } from './mock.adapter';
import { ContabilidadAdapter } from './contabilidad.adapter';
import { Factura } from '../facturas/factura.entity';
import { Pago } from '../pagos/pago.entity';
import { Unidad } from '@modules/unidades/unidad.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Factura, Pago, Unidad]),
    BullModule.registerQueue({ name: 'contabilidad-sync' }),
  ],
  providers: [
    MockAdapter,
    ContabilidadAdapter,
    {
      provide: 'CONTABILIDAD_PORT',
      useExisting: ContabilidadAdapter,
    },
  ],
  exports: ['CONTABILIDAD_PORT', BullModule],
})
export class ContabilidadAdapterModule {}
