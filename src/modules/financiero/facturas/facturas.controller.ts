import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { CreateFacturaDto, BulkGenerateFacturasDto, UpdateFacturaDto } from './dto/factura.dto';
import { FacturaTipo, FacturaEstadoSync } from './factura.entity';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';

@Controller('facturas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post('generar-mensual')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  async generateMonthly(
    @Body() dto: BulkGenerateFacturasDto,
  ) {
    // tenantId comes from request.tenantContext
    const tenantId = 'current-tenant-id'; // In real impl: request.tenantContext.tenantId
    return this.facturasService.generateMonthlyOrdinaryInvoices(tenantId, dto.periodo);
  }

  @Post('extraordinaria')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async createExtraordinary(
    @Body() dto: CreateFacturaDto,
  ) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.createExtraordinaryInvoice(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findAll(
    @Query('unidad_id') unidad_id?: string,
    @Query('periodo') periodo?: string,
    @Query('tipo') tipo?: FacturaTipo,
    @Query('estado_sync') estado_sync?: FacturaEstadoSync,
    @Query('vencidas') vencidas?: boolean,
  ) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.findByTenant(tenantId, {
      unidad_id,
      periodo,
      tipo,
      estado_sync,
      vencidas,
    });
  }

  @Get('estado-cuenta/:unidadId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  async getEstadoCuenta(
    @Param('unidadId') unidadId: string,
  ) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.getEstadoCuenta(tenantId, unidadId);
  }

  @Get('pendientes/:unidadId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  async getFacturasPendientes(
    @Param('unidadId') unidadId: string,
  ) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.getFacturasPendientes(tenantId, unidadId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findOne(@Param('id') id: string) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.findById(id, tenantId);
  }

  @Patch(':id/retry-sync')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async retrySync(@Param('id') id: string) {
    const tenantId = 'current-tenant-id';
    return this.facturasService.retrySync(id, tenantId);
  }
}