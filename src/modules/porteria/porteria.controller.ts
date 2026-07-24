import { Controller, Post, Body, Get, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PorteriaService } from './porteria.service';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';

@ApiTags('Portería')
@ApiBearerAuth()
@Controller('porteria')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PorteriaController {
  constructor(private readonly porteriaService: PorteriaService) {}

  // =============================================
  // SINCRONIZACIÓN (endpoint principal)
  // =============================================

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sincronizar lote de registros de portería (idempotente por localUuid)' })
  @ApiResponse({ status: 200, description: 'Lote sincronizado correctamente' })
  async sincronizarLote(@Body() body: { items: Array<{ tabla: string; localUuid: string; data: any }> }) {
    return this.porteriaService.sincronizarLote(body.items);
  }

  // =============================================
  // VISITANTES PREAUTORIZADOS
  // =============================================

  @Post('visitantes')
  @ApiOperation({ summary: 'Crear visitante preautorizado (genera QR autocontenido)' })
  async crearVisitante(@Body() data: any) {
    return this.porteriaService.crearVisitantePreautorizado(data);
  }

  @Get('visitantes')
  @ApiOperation({ summary: 'Listar visitantes preautorizados del tenant' })
  async listarVisitantes(
    @Query('unidadId') unidadId?: string,
    @Query('vigentes') vigentes?: boolean,
  ) {
    return this.porteriaService.listarVisitantesPreautorizados(unidadId, vigentes);
  }

  @Get('visitantes/:id/qr')
  @ApiOperation({ summary: 'Obtener QR code del visitante' })
  async obtenerQr(@Param('id') id: string) {
    return this.porteriaService.obtenerQrVisitante(id);
  }

  @Post('validar-qr')
  @ApiOperation({ summary: 'Validar QR de visitante preautorizado (offline-first, sin side effects)' })
  async validarQr(@Body() body: { qrCode: string }) {
    return this.porteriaService.validarQrVisitante(body.qrCode);
  }

  // =============================================
  // REGISTROS DE ACCESO
  // =============================================

  @Post('accesos')
  @ApiOperation({ summary: 'Registrar acceso manual (fallback sin QR)' })
  async registrarAcceso(@Body() data: any) {
    return this.porteriaService.registrarAcceso(data);
  }

  @Get('accesos')
  @ApiOperation({ summary: 'Listar registros de acceso' })
  async listarAccesos(
    @Query('unidadId') unidadId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('sincronizado') sincronizado?: boolean,
  ) {
    return this.porteriaService.listarAccesos(unidadId, desde, hasta, sincronizado);
  }

  // =============================================
  // CORRESPONDENCIA
  // =============================================

  @Post('correspondencia')
  @ApiOperation({ summary: 'Recibir correspondencia' })
  async recibirCorrespondencia(@Body() data: any) {
    return this.porteriaService.recibirCorrespondencia(data);
  }

  @Post('correspondencia/:id/entregar')
  @ApiOperation({ summary: 'Entregar correspondencia con firma digital' })
  async entregarCorrespondencia(@Param('id') id: string, @Body() data: { firmaDigital: string; recibidoPor: string }) {
    return this.porteriaService.entregarCorrespondencia(id, data.firmaDigital, data.recibidoPor);
  }

  @Get('correspondencia')
  @ApiOperation({ summary: 'Listar correspondencia' })
  async listarCorrespondencia(
    @Query('unidadId') unidadId?: string,
    @Query('entregada') entregada?: boolean,
  ) {
    return this.porteriaService.listarCorrespondencia(unidadId, entregada);
  }

  // =============================================
  // MINUTAS DE TURNO
  // =============================================

  @Post('minutas')
  @ApiOperation({ summary: 'Iniciar minuta de turno' })
  async iniciarMinuta(@Body() data: any) {
    return this.porteriaService.iniciarMinuta(data);
  }

  @Post('minutas/:id/finalizar')
  @ApiOperation({ summary: 'Finalizar minuta de turno' })
  async finalizarMinuta(@Param('id') id: string, @Body() data: { novedades: string }) {
    return this.porteriaService.finalizarMinuta(id, data.novedades);
  }

  @Get('minutas')
  @ApiOperation({ summary: 'Listar minutas de turno' })
  async listarMinutas(
    @Query('porteroId') porteroId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.porteriaService.listarMinutas(porteroId, desde, hasta);
  }

  // =============================================
  // INCIDENTES
  // =============================================

  @Post('incidentes')
  @ApiOperation({ summary: 'Reportar incidente (pánico/incidente/mantenimiento)' })
  async reportarIncidente(@Body() data: any) {
    return this.porteriaService.reportarIncidente(data);
  }

  @Get('incidentes')
  @ApiOperation({ summary: 'Listar incidentes' })
  async listarIncidentes(
    @Query('porteroId') porteroId?: string,
    @Query('tipo') tipo?: string,
    @Query('prioridad') prioridad?: boolean,
  ) {
    return this.porteriaService.listarIncidentes(porteroId, tipo, prioridad);
  }
}