import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { Pago } from './pago.entity';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { FacturaPagoListener } from './factura-pago.listener';
import { ContabilidadAdapterModule } from '../contabilidad-adapter/contabilidad-adapter.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago]),
    EventEmitterModule,
    BullModule,
    ContabilidadAdapterModule,
  ],
  providers: [PagosService, FacturaPagoListener],
  controllers: [PagosController],
  exports: [PagosService],
})
export class PagosModule {}
