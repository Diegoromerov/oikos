import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZonaComun } from './zona-comun.entity';
import { Reserva } from './reserva.entity';
import { ReservasService } from './reservas.service';
import { ReservasController } from './reservas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ZonaComun, Reserva])],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}