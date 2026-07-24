import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService, DashboardStats } from './dashboard.service';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
    UserRole.JUNTA,
    UserRole.REVISOR_FISCAL,
  )
  @ApiOperation({ summary: 'Obtener estadísticas del dashboard para el tenant actual' })
  @ApiResponse({ status: 200, description: 'Estadísticas del dashboard' })
  async getStats(@Request() req: any): Promise<DashboardStats> {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant context not found');
    }
    return this.dashboardService.getStats(tenantId);
  }
}