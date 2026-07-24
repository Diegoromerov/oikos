import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReservasService } from './reservas.service';
import { ZonaComun } from './zona-comun.entity';
import { Reserva, ReservaEstado } from './reserva.entity';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';

interface CreateZonaComunDto {
  nombre: string;
  descripcion?: string;
  capacidadMaxima: number;
  costo?: number;
  requiereAprobacion?: boolean;
  horarioDisponible: Record<string, { inicio: string; fin: string }[]>;
}

interface CreateReservaDto {
  zonaComunId: string;
  unidadId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  observaciones?: string;
}

interface UpdateReservaDto {
  estado?: ReservaEstado;
  observaciones?: string;
}

@ApiTags('Reservas')
@ApiBearerAuth()
@Controller('reservas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  // ===========================================
  // ZONAS COMUNES
  // ===========================================

  @Post('zonas')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Crear zona común' })
  @ApiResponse({ status: 201, type: ZonaComun })
  async crearZona(
    @Body() dto: CreateZonaComunDto,
    @Query('tenantId') tenantId: string,
  ): Promise<ZonaComun> {
    return this.reservasService.crearZonaComun(tenantId, dto);
  }

  @Get('zonas')
  @Roles(UserRole.ADMIN, UserRole.JUNTA, UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.PORTERO)
  @ApiOperation({ summary: 'Listar zonas comunes' })
  @ApiQuery({ name: 'soloActivas', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [ZonaComun] })
  async listarZonas(
    @Query('tenantId') tenantId: string,
    @Query('soloActivas') soloActivas?: string,
  ): Promise<ZonaComun[]> {
    return this.reservasService.listarZonasComunes(tenantId, soloActivas !== 'false');
  }

  @Get('zonas/:id')
  @Roles(UserRole.ADMIN, UserRole.JUNTA, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  @ApiOperation({ summary: 'Obtener zona común' })
  @ApiResponse({ status: 200, type: ZonaComun })
  async obtenerZona(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<ZonaComun> {
    return this.reservasService.obtenerZonaComun(id, tenantId);
  }

  @Put('zonas/:id')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Actualizar zona común' })
  @ApiResponse({ status: 200, type: ZonaComun })
  async actualizarZona(
    @Param('id') id: string,
    @Body() dto: Partial<CreateZonaComunDto>,
    @Query('tenantId') tenantId: string,
  ): Promise<ZonaComun> {
    return this.reservasService.actualizarZonaComun(id, tenantId, dto);
  }

  @Delete('zonas/:id')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Eliminar/desactivar zona común' })
  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarZona(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<void> {
    await this.reservasService.eliminarZonaComun(id, tenantId);
  }

  // ===========================================
  // RESERVAS
  // ===========================================

  @Post()
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Crear reserva' })
  @ApiResponse({ status: 201, type: Reserva })
  async crearReserva(
    @Body() dto: CreateReservaDto,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ): Promise<Reserva> {
    return this.reservasService.crearReserva(userId, tenantId, dto);
  }

  @Get()
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA, UserRole.PORTERO)
  @ApiOperation({ summary: 'Listar reservas con filtros' })
  @ApiQuery({ name: 'zonaComunId', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: ReservaEstado })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiResponse({ status: 200, type: [Reserva] })
  async listarReservas(
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
    @Query('isAdmin') isAdmin: string,
    @Query('zonaComunId') zonaComunId?: string,
    @Query('estado') estado?: ReservaEstado,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ): Promise<Reserva[]> {
    return this.reservasService.listarReservas(tenantId, { zonaComunId, estado, fechaDesde, fechaHasta }, isAdmin === 'true', userId);
  }

  @Get('disponibilidad')
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Ver disponibilidad de una zona en una fecha' })
  @ApiQuery({ name: 'zonaComunId', required: true })
  @ApiQuery({ name: 'fecha', required: true })
  @ApiResponse({ status: 200, type: [Object] })
  async getDisponibilidad(
    @Query('tenantId') tenantId: string,
    @Query('zonaComunId') zonaComunId: string,
    @Query('fecha') fecha: string,
  ): Promise<Array<{ horaInicio: string; horaFin: string; disponible: boolean; reservaId?: string }>> {
    return this.reservasService.getDisponibilidad(zonaComunId, fecha, tenantId);
  }

  @Get(':id')
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Obtener reserva por ID' })
  @ApiResponse({ status: 200, type: Reserva })
  async obtenerReserva(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<Reserva> {
    return this.reservasService.obtenerReserva(id, tenantId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Actualizar estado de reserva (confirmar/rechazar)' })
  @ApiResponse({ status: 200, type: Reserva })
  async actualizarReserva(
    @Param('id') id: string,
    @Body() dto: UpdateReservaDto,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ): Promise<Reserva> {
    return this.reservasService.actualizarReserva(id, tenantId, dto, userId);
  }

  @Put(':id/cancelar')
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Cancelar reserva' })
  @ApiResponse({ status: 200, type: Reserva })
  async cancelarReserva(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
    @Query('isAdmin') isAdmin: string,
  ): Promise<Reserva> {
    return this.reservasService.cancelarReserva(id, tenantId, userId, isAdmin === 'true');
  }
}