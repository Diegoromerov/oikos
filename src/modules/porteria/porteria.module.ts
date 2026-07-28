import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PorteriaController } from './porteria.controller';
import { PorteriaService } from './porteria.service';
import { RegistroAcceso } from './registro-acceso.entity';
import { Correspondencia } from './correspondencia.entity';
import { MinutaTurno } from './minuta-turno.entity';
import { Incidente } from './incidente.entity';
import { VisitantesPreautorizados } from './visitantes-preautorizados.entity';

if (!process.env.QR_SIGNING_SECRET) {
  throw new Error('QR_SIGNING_SECRET environment variable is required but not defined');
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegistroAcceso,
      Correspondencia,
      MinutaTurno,
      Incidente,
      VisitantesPreautorizados,
    ]),
    JwtModule.register({
      secret: process.env.QR_SIGNING_SECRET,
      signOptions: { expiresIn: '1y' },
    }),
  ],
  controllers: [PorteriaController],
  providers: [PorteriaService],
  exports: [PorteriaService],
})
export class PorteriaModule {}