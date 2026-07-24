import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pqrs } from './pqrs.entity';
import { PqrsSeguimiento } from './pqrs-seguimiento.entity';
import { PqrsService } from './pqrs.service';
import { PqrsController } from './pqrs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pqrs, PqrsSeguimiento])],
  controllers: [PqrsController],
  providers: [PqrsService],
  exports: [PqrsService],
})
export class PqrsModule {}