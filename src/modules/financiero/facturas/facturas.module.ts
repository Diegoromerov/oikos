import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura]),
    BullModule.registerQueue({ name: 'contabilidad-sync' }),
  ],
  providers: [FacturasService],
  controllers: [FacturasController],
  exports: [FacturasService],
})
export class FacturasModule {}