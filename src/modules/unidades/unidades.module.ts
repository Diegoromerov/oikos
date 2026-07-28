import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Tenant } from '@modules/tenants/tenant.entity';
import { Unidad } from './unidad.entity';
import { UnidadesService } from './unidades.service';
import { UnidadesController } from './unidades.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unidad, Tenant]),
    TenantsModule,
    BullModule.registerQueue({ name: 'unidades-validation' }),
  ],
  providers: [UnidadesService],
  controllers: [UnidadesController],
  exports: [UnidadesService],
})
export class UnidadesModule {}