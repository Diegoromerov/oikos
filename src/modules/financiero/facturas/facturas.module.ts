import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { Factura } from './factura.entity';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { Unidad } from '@modules/unidades/unidad.entity';
import { Tenant } from '@modules/tenants/tenant.entity';
import { ContabilidadAdapterModule } from '../contabilidad-adapter/contabilidad-adapter.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, Unidad, Tenant]),
    EventEmitterModule,
    BullModule,
    ContabilidadAdapterModule,
  ],
  providers: [FacturasService],
  controllers: [FacturasController],
  exports: [FacturasService],
})
export class FacturasModule {}
