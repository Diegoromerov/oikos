import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Request } from 'express';

export const TENANT_CONTEXT_KEY = 'tenant_context';

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantContextService {
  private tenantContext: Map<string, TenantContext> = new Map();

  setContext(requestId: string, context: TenantContext): void {
    this.tenantContext.set(requestId, context);
  }

  getContext(requestId: string): TenantContext | undefined {
    return this.tenantContext.get(requestId);
  }

  clearContext(requestId: string): void {
    this.tenantContext.delete(requestId);
  }

  getCurrentTenantId(): string | undefined {
    return undefined;
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    const user = (request as any).user;
    
    if (!user) {
      return false;
    }

    const tenantContext: TenantContext = {
      tenantId: user.tenantId,
      userId: user.id,
      roles: user.roles || [],
      isSuperAdmin: user.roles?.includes('superadmin') || false,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(
        `SELECT set_config('app.current_tenant', $1, true)`,
        [tenantContext.tenantId],
      );
      
      if (tenantContext.isSuperAdmin) {
        await queryRunner.query(
          `SELECT set_config('app.is_superadmin', 'true', true)`,
        );
      }
    } finally {
      await queryRunner.release();
    }

    (request as any).tenantContext = tenantContext;
    
    return true;
  }
}

export const TENANT_GUARD_KEY = 'tenant_guard';