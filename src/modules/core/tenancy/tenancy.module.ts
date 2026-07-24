import { Module } from '@nestjs/common';
import { TenantContextService, TenantGuard } from './tenant-context.service';
import { DataSource } from 'typeorm';

@Module({
  providers: [
    TenantContextService,
    TenantGuard,
  ],
  exports: [TenantContextService, TenantGuard],
})
export class TenancyModule {}