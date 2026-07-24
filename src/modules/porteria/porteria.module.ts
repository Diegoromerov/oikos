import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PorteriaController } from './porteria.controller';
import { PorteriaService } from './porteria.service';
import { RegistroAcceso } from './registro-acceso.entity';
import { Correspondencia } from './correspondencia.entity';
import { MinutaTurno } from './minuta-turno.entity';
import { Incidente } from './incidente.entity';
import { VisitantesPreautorizados } from './visitantes-preautorizados.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegistroAcceso,
      Correspondencia,
      MinutaTurno,
      Incidente,
      VisitantesPreautorizados,
    ]),
  ],
  controllers: [PorteriaController],
  providers: [PorteriaService],
  exports: [PorteriaService],
})
export class PorteriaModule {}