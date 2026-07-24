import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto/pago.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';
import { PagoEstadoSync } from './pago.entity';

@Controller('pagos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.PORTERO)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPagoDto: CreatePagoDto) {
    return this.pagosService.createWompiPayment('tenantId', createPagoDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findAll(
    @Query('unidad_id') unidad_id?: string,
    @Query('factura_id') factura_id?: string,
    @Query('estado_sync') estado_sync?: string,
    @Query('metodo_pago') metodo_pago?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.pagosService.findByTenant('tenantId', {
      unidad_id,
      factura_id,
      estado_sync: estado_sync as any,
      metodo_pago: metodo_pago as any,
      fecha_desde: fecha_desde ? new Date(fecha_desde) : undefined,
      fecha_hasta: fecha_hasta ? new Date(fecha_hasta) : undefined,
    });
  }

  @Get('pendientes-sync')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async getPendingSync() {
    return this.pagosService.findByTenant('tenantId', {
      estado_sync: PagoEstadoSync.PENDIENTE_SINCRONIZAR_SIIGO,
    });
  }

  @Get('unidad/:unidadId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL, UserRole.PORTERO)
  async getByUnidad(@Param('unidadId', ParseUUIDPipe) unidadId: string) {
    return this.pagosService.getPaymentsByUnidad('tenantId', unidadId);
  }

  @Get('factura/:facturaId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async getByFactura(@Param('facturaId', ParseUUIDPipe) facturaId: string) {
    return this.pagosService.findByTenant('tenantId', { factura_id: facturaId });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagosService.findById(id, 'tenantId');
  }

  @Patch(':id/retry-sync')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async retrySync(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagosService.retrySync(id, 'tenantId');
  }

  @Patch(':id/sync-status')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async updateSyncStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { estado: string; siigoId?: string; error?: string },
  ) {
    return this.pagosService.updateSyncStatus(id, 'tenantId', body.estado as any, body.siigoId, body.error);
  }
}