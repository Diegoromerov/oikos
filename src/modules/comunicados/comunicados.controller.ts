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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { ComunicadosService } from './comunicados.service';
import { Comunicado } from './comunicado.entity';
import { CreateComunicadoDto, UpdateComunicadoDto, ComunicadoTipo, ComunicadoListQuery, ComunicadoListResponse } from './comunicado.dto';

@ApiTags('Comunicados')
@ApiBearerAuth()
@Controller('comunicados')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  @Post()
  @Roles('admin', 'junta_directiva')
  @ApiOperation({ summary: 'Crear nuevo comunicado (solo admin/junta)' })
  @ApiResponse({ status: 201, description: 'Comunicado creado', type: Comunicado })
  async crear(
    @Body() dto: CreateComunicadoDto,
    @Query('tenantId') tenantId: string,
    @Query('usuarioId') usuarioId: string,
  ): Promise<Comunicado> {
    return this.comunicadosService.crear(dto, tenantId, usuarioId);
  }

  @Get()
  @Roles('admin', 'junta_directiva', 'residente', 'portero')
  @ApiOperation({ summary: 'Listar comunicados con filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: ComunicadoTipo })
  @ApiQuery({ name: 'soloVigentes', required: false, type: Boolean })
  async listar(
    @Query() query: ComunicadoListQuery,
    @Query('tenantId') tenantId: string,
  ): Promise<ComunicadoListResponse> {
    return this.comunicadosService.listar(tenantId, query);
  }

  @Get('residente')
  @Roles('residente')
  @ApiOperation({ summary: 'Listar comunicados para residente (solo vigentes)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: ComunicadoTipo })
  async listarParaResidente(
    @Query() query: ComunicadoListQuery,
    @Query('tenantId') tenantId: string,
  ): Promise<ComunicadoListResponse> {
    return this.comunicadosService.listarParaResidente(tenantId, query);
  }

  @Get(':id')
  @Roles('admin', 'junta_directiva', 'residente', 'portero')
  @ApiOperation({ summary: 'Obtener comunicado por ID' })
  @ApiResponse({ status: 200, description: 'Comunicado encontrado', type: Comunicado })
  @ApiResponse({ status: 404, description: 'Comunicado no encontrado' })
  async obtenerPorId(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<Comunicado> {
    return this.comunicadosService.obtenerPorId(id, tenantId);
  }

  @Put(':id')
  @Roles('admin', 'junta_directiva')
  @ApiOperation({ summary: 'Actualizar comunicado (solo admin/junta)' })
  @ApiResponse({ status: 200, description: 'Comunicado actualizado', type: Comunicado })
  @ApiResponse({ status: 404, description: 'Comunicado no encontrado' })
  async actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateComunicadoDto,
    @Query('tenantId') tenantId: string,
  ): Promise<Comunicado> {
    return this.comunicadosService.actualizar(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('admin', 'junta_directiva')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar comunicado (solo admin/junta)' })
  @ApiResponse({ status: 204, description: 'Comunicado eliminado' })
  @ApiResponse({ status: 404, description: 'Comunicado no encontrado' })
  async eliminar(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<void> {
    return this.comunicadosService.eliminar(id, tenantId);
  }
}