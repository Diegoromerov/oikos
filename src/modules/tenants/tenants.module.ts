import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@modules/tenants/tenant.entity';
import { TenantsService } from '@modules/tenants/tenants.service';
import { TenantsController } from '@modules/tenants/tenants.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantsService],
  controllers: [TenantsController],
  exports: [TenantsService],
})
export class TenantsModule {}