import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Pago } from './pago.entity';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago]),
    BullModule.registerQueue({ name: 'contabilidad-sync' }),
  ],
  providers: [PagosService],
  controllers: [PagosController],
  exports: [PagosService],
})
export class PagosModule {}