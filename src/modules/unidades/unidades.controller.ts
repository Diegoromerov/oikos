import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UnidadesService } from './unidades.service';
import { CreateUnidadDto, UpdateUnidadDto, BulkUnidadDto } from './dto/unidad.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';

@Controller('unidades')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async create(
    @Body() createUnidadDto: CreateUnidadDto,
    @Param('tenantId') tenantId: string, // This will be set by TenantGuard
  ) {
    // In real implementation, tenantId comes from request.tenantContext
    return this.unidadesService.create(createUnidadDto, tenantId);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async bulkCreate(
    @Body() bulkDto: BulkUnidadDto,
    @Param('tenantId') tenantId: string,
  ) {
    return this.unidadesService.bulkCreate(bulkDto, tenantId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findAll(
    @Query('activo') activo?: boolean,
    @Query('tipo_unidad') tipo_unidad?: string,
  ) {
    // tenantId comes from request.tenantContext
    return this.unidadesService.findAll('tenantId', { activo, tipo_unidad: tipo_unidad as any });
  }

  @Get('coeficientes/reporte')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async getCoefficientReport() {
    return this.unidadesService.getCoefficientReport('tenantId');
  }

  @Get('coeficientes/validar')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async validateCoefficients() {
    return this.unidadesService.validateCoefficients('tenantId');
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL, UserRole.PORTERO)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unidadesService.findOne(id, 'tenantId');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnidadDto: UpdateUnidadDto,
  ) {
    return this.unidadesService.update(id, 'tenantId', updateUnidadDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.unidadesService.remove(id, 'tenantId');
  }
}