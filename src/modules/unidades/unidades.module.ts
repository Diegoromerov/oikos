import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unidad } from './unidad.entity';
import { UnidadesService } from './unidades.service';
import { UnidadesController } from './unidades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Unidad])],
  providers: [UnidadesService],
  controllers: [UnidadesController],
  exports: [UnidadesService],
})
export class UnidadesModule {}