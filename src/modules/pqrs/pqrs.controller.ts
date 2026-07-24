import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PqrsService } from './pqrs.service';
import { Pqrs, PqrsEstado, PqrsPrioridad, PqrsTipo } from './pqrs.entity';
import { PqrsSeguimiento } from './pqrs-seguimiento.entity';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { UserRole } from '@modules/usuarios/user.entity';

interface CreatePqrsDto {
  tipo: PqrsTipo;
  prioridad: PqrsPrioridad;
  asunto: string;
  descripcion: string;
  unidadId: string;
}

interface UpdatePqrsDto {
  estado?: PqrsEstado;
  asignadoA?: string;
  prioridad?: PqrsPrioridad;
}

interface AddSeguimientoDto {
  comentario: string;
  esInterno?: boolean;
}

@ApiTags('PQRS')
@ApiBearerAuth()
@Controller('pqrs')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PqrsController {
  constructor(private readonly pqrsService: PqrsService) {}

  @Post()
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Crear nuevo PQRS' })
  @ApiResponse({ status: 201, type: Pqrs })
  async create(
    @Body() dto: CreatePqrsDto,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ): Promise<Pqrs> {
    return this.pqrsService.create(userId, tenantId, dto);
  }

  @Get()
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA, UserRole.PORTERO)
  @ApiOperation({ summary: 'Listar PQRS con filtros' })
  @ApiQuery({ name: 'estado', required: false, enum: PqrsEstado })
  @ApiQuery({ name: 'tipo', required: false, enum: PqrsTipo })
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'usuarioId', required: false })
  @ApiResponse({ status: 200, type: [Pqrs] })
  async findAll(
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
    @Query('isAdmin') isAdmin: string,
    @Query('estado') estado?: PqrsEstado,
    @Query('tipo') tipo?: PqrsTipo,
    @Query('unidadId') unidadId?: string,
    @Query('usuarioId') usuarioId?: string,
  ): Promise<Pqrs[]> {
    return this.pqrsService.findAll(tenantId, { estado, tipo, unidadId, usuarioId }, isAdmin === 'true', userId);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Estadísticas de PQRS para dashboard admin' })
  async getStats(@Query('tenantId') tenantId: string) {
    return this.pqrsService.getStats(tenantId);
  }

  @Get('vencidos')
  @Roles(UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'PQRS vencidos (pasado SLA sin resolver)' })
  async getVencidos(@Query('tenantId') tenantId: string): Promise<Pqrs[]> {
    return this.pqrsService.getVencidos(tenantId);
  }

  @Get(':id')
  @Roles(UserRole.PROPIETARIO, UserRole.RESIDENTE, UserRole.ADMIN, UserRole.JUNTA)
  @ApiOperation({ summary: 'Obtener PQRS por ID' })
  @ApiResponse({ status: 200, type: Pqrs })
  async findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<Pqrs> {
    return this.pqrsService.findOne(id, tenantId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.JUNTA, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  @ApiOperation({ summary: 'Actualizar PQRS (cambio de estado, asignación, etc.)' })
  @ApiResponse({ status: 200, type: Pqrs })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePqrsDto,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ): Promise<Pqrs> {
    return this.pqrsService.update(id, tenantId, dto, userId);
  }

  @Post(':id/seguimientos')
  @Roles(UserRole.ADMIN, UserRole.JUNTA, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  @ApiOperation({ summary: 'Agregar seguimiento/comentario al PQRS' })
  @ApiResponse({ status: 201, type: PqrsSeguimiento })
  async addSeguimiento(
    @Param('id') id: string,
    @Body() dto: AddSeguimientoDto,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
  ): Promise<PqrsSeguimiento> {
    return this.pqrsService.addSeguimiento(id, tenantId, userId, dto.comentario, dto.esInterno || false);
  }

  @Get(':id/seguimientos')
  @Roles(UserRole.ADMIN, UserRole.JUNTA, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  @ApiOperation({ summary: 'Obtener seguimientos del PQRS' })
  @ApiResponse({ status: 200, type: [PqrsSeguimiento] })
  async getSeguimientos(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('isAdmin') isAdmin: string,
  ): Promise<PqrsSeguimiento[]> {
    return this.pqrsService.getSeguimientos(id, tenantId, isAdmin === 'true');
  }
}