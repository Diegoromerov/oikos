import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RegistroAcceso } from './registro-acceso.entity';
import { Correspondencia } from './correspondencia.entity';
import { MinutaTurno } from './minuta-turno.entity';
import { Incidente } from './incidente.entity';
import { VisitantesPreautorizados } from './visitantes-preautorizados.entity';
import { VisitantePreautorizado } from './visitante-preautorizado.entity';
import { JwtService } from '@nestjs/jwt';

interface SyncBatchItem {
  tabla: string;
  localUuid: string;
  data: Record<string, any>;
}

@Injectable()
export class PorteriaService {
  private readonly logger = new Logger(PorteriaService.name);

  constructor(
    @InjectRepository(RegistroAcceso)
    private readonly registroAccesoRepo: Repository<RegistroAcceso>,
    @InjectRepository(Correspondencia)
    private readonly correspondenciaRepo: Repository<Correspondencia>,
    @InjectRepository(MinutaTurno)
    private readonly minutaTurnoRepo: Repository<MinutaTurno>,
    @InjectRepository(Incidente)
    private readonly incidenteRepo: Repository<Incidente>,
    @InjectRepository(VisitantesPreautorizados)
    private readonly visitantesPreautorizadosRepo: Repository<VisitantesPreautorizados>,
    @InjectRepository(VisitantePreautorizado)
    private readonly visitantePreautorizadoRepo: Repository<VisitantePreautorizado>,
    private readonly jwtService: JwtService,
  ) {}

  // =============================================
  // SINCRONIZACIÓN IDEMPOTENTE
  // =============================================

  async sincronizarLote(items: SyncBatchItem[]): Promise<{ sincronizados: number; duplicados: number; errores: number }> {
    let sincronizados = 0;
    let duplicados = 0;
    let errores = 0;

    for (const item of items) {
      try {
        const resultado = await this.upsertIdempotente(item.tabla, item.localUuid, item.data);
        if (resultado === 'insertado') sincronizados++;
        else if (resultado === 'duplicado') duplicados++;
      } catch (error) {
        this.logger.error(`Error sincronizando ${item.tabla} ${item.localUuid}: ${error.message}`);
        errores++;
      }
    }

    return { sincronizados, duplicados, errores };
  }

  private async upsertIdempotente(tabla: string, localUuid: string, data: Record<string, any>): Promise<'insertado' | 'duplicado'> {
    const repo = this.getRepo(tabla);
    
    // Verificar si ya existe por localUuid
    const existente = await repo.findOne({ where: { localUuid } });
    if (existente) {
      return 'duplicado';
    }

    // Crear nuevo registro
    const entidad = repo.create({ ...data, localUuid });
    await repo.save(entidad);
    return 'insertado';
  }

  private getRepo(tabla: string): Repository<any> {
    switch (tabla) {
      case 'registros_acceso': return this.registroAccesoRepo;
      case 'correspondencia': return this.correspondenciaRepo;
      case 'minutas_turno': return this.minutaTurnoRepo;
      case 'incidentes': return this.incidenteRepo;
      case 'visitantes_preautorizados': return this.visitantesPreautorizadosRepo;
      default: throw new Error(`Tabla desconocida: ${tabla}`);
    }
  }

  // =============================================
  // VISITANTES PREAUTORIZADOS
  // =============================================

  async crearVisitantePreautorizado(data: Partial<VisitantesPreautorizados>): Promise<VisitantesPreautorizados> {
    const visitante = this.visitantesPreautorizadosRepo.create(data);
    const saved = await this.visitantesPreautorizadosRepo.save(visitante);

    // Generar QR con el ID real
    const qrPayload = {
      unidadId: data.unidadId,
      visitanteId: saved.id,
      tenantId: data.tenantId,
      validoDesde: data.validoDesde,
      validoHasta: data.validoHasta,
      tipo: 'visitante_preautorizado',
    };

    const qrCode = this.jwtService.sign(qrPayload, {
      secret: this.getQrSigningSecret(data.tenantId ?? ''),
      expiresIn: '1y',
    });

    saved.qrCode = qrCode;
    return this.visitantesPreautorizadosRepo.save(saved);
  }

  async listarVisitantesPreautorizados(unidadId?: string, vigentes?: boolean): Promise<VisitantesPreautorizados[]> {
    const qb = this.visitantesPreautorizadosRepo.createQueryBuilder('v')
      .orderBy('v.validoDesde', 'DESC');

    if (unidadId) qb.andWhere('v.unidadId = :unidadId', { unidadId });
    if (vigentes) {
      const ahora = new Date();
      qb.andWhere('v.validoDesde <= :ahora', { ahora })
        .andWhere('v.validoHasta >= :ahora', { ahora });
    }

    return qb.getMany();
  }

  async obtenerQrVisitante(id: string): Promise<{ qrCode: string }> {
    const visitante = await this.visitantesPreautorizadosRepo.findOne({ where: { id } });
    if (!visitante) throw new Error('Visitante no encontrado');
    return { qrCode: visitante.qrCode };
  }

  async validarQrVisitante(qrCode: string): Promise<{ valido: boolean; datos?: any; error?: string }> {
    try {
      // El tenantId se extrae del payload para obtener la clave secreta
      const payload = this.jwtService.decode(qrCode) as any;
      if (!payload?.tenantId) return { valido: false, error: 'QR inválido: sin tenantId' };

      const secret = this.getQrSigningSecret(payload.tenantId);
      const verificado = this.jwtService.verify(qrCode, { secret });

      const ahora = new Date();
      const validoDesde = new Date(verificado.validoDesde);
      const validoHasta = new Date(verificado.validoHasta);

      if (ahora < validoDesde) return { valido: false, error: 'QR aún no es válido' };
      if (ahora > validoHasta) return { valido: false, error: 'QR expirado' };

      const visitante = await this.visitantesPreautorizadosRepo.findOne({
        where: { id: verificado.visitanteId, tenantId: verificado.tenantId },
      });

      if (!visitante) return { valido: false, error: 'Visitante no encontrado' };
      if (visitante.usadoEn) return { valido: false, error: 'QR ya fue utilizado' };

      return { valido: true, datos: { ...verificado, visitante } };
    } catch (error) {
      return { valido: false, error: 'QR inválido o firma incorrecta' };
    }
  }

  // =============================================
  // REGISTROS DE ACCESO
  // =============================================

  async registrarAcceso(data: Partial<RegistroAcceso>): Promise<RegistroAcceso> {
    const registro = this.registroAccesoRepo.create(data);
    return this.registroAccesoRepo.save(registro);
  }

  async listarAccesos(
    unidadId?: string,
    desde?: string,
    hasta?: string,
    sincronizado?: boolean,
  ): Promise<RegistroAcceso[]> {
    const qb = this.registroAccesoRepo.createQueryBuilder('r').orderBy('r.timestampLocal', 'DESC');

    if (unidadId) qb.andWhere('r.unidadId = :unidadId', { unidadId });
    if (desde) qb.andWhere('r.timestampLocal >= :desde', { desde });
    if (hasta) qb.andWhere('r.timestampLocal <= :hasta', { hasta });
    if (sincronizado !== undefined) {
      qb.andWhere(sincronizado ? 'r.sincronizadoEn IS NOT NULL' : 'r.sincronizadoEn IS NULL');
    }

    return qb.getMany();
  }

  // =============================================
  // CORRESPONDENCIA
  // =============================================

  async recibirCorrespondencia(data: Partial<Correspondencia>): Promise<Correspondencia> {
    const corr = this.correspondenciaRepo.create(data);
    return this.correspondenciaRepo.save(corr);
  }

  async entregarCorrespondencia(
    id: string,
    firmaDigital: string,
    recibidoPor: string,
  ): Promise<Correspondencia> {
    const corr = await this.correspondenciaRepo.findOne({ where: { id } });
    if (!corr) throw new Error('Correspondencia no encontrada');

    corr.entregadoEn = new Date();
    corr.firmaDigital = firmaDigital;
    corr.recibidoPor = recibidoPor;
    return this.correspondenciaRepo.save(corr);
  }

  async listarCorrespondencia(unidadId?: string, entregada?: boolean): Promise<Correspondencia[]> {
    const qb = this.correspondenciaRepo.createQueryBuilder('c').orderBy('c.recibidoEn', 'DESC');
    if (unidadId) qb.andWhere('c.unidadId = :unidadId', { unidadId });
    if (entregada !== undefined) {
      qb.andWhere(entregada ? 'c.entregadoEn IS NOT NULL' : 'c.entregadoEn IS NULL');
    }
    return qb.getMany();
  }

  // =============================================
  // MINUTAS DE TURNO
  // =============================================

  async iniciarMinuta(data: Partial<MinutaTurno>): Promise<MinutaTurno> {
    const minuta = this.minutaTurnoRepo.create(data);
    return this.minutaTurnoRepo.save(minuta);
  }

  async finalizarMinuta(id: string, novedades: string): Promise<MinutaTurno> {
    const minuta = await this.minutaTurnoRepo.findOne({ where: { id } });
    if (!minuta) throw new Error('Minuta no encontrada');

    minuta.turnoFin = new Date();
    minuta.novedades = novedades;
    return this.minutaTurnoRepo.save(minuta);
  }

  async listarMinutas(porteroId?: string, desde?: string, hasta?: string): Promise<MinutaTurno[]> {
    const qb = this.minutaTurnoRepo.createQueryBuilder('m').orderBy('m.turnoInicio', 'DESC');
    if (porteroId) qb.andWhere('m.porteroId = :porteroId', { porteroId });
    if (desde) qb.andWhere('m.turnoInicio >= :desde', { desde });
    if (hasta) qb.andWhere('m.turnoInicio <= :hasta', { hasta });
    return qb.getMany();
  }

  // =============================================
  // INCIDENTES
  // =============================================

  async reportarIncidente(data: Partial<Incidente>): Promise<Incidente> {
    const incidente = this.incidenteRepo.create(data);
    return this.incidenteRepo.save(incidente);
  }

  async listarIncidentes(porteroId?: string, tipo?: string, prioridad?: boolean): Promise<Incidente[]> {
    const qb = this.incidenteRepo.createQueryBuilder('i').orderBy('i.creadoEn', 'DESC');
    if (porteroId) qb.andWhere('i.porteroId = :porteroId', { porteroId });
    if (tipo) qb.andWhere('i.tipoIncidente = :tipo', { tipo });
    if (prioridad !== undefined) qb.andWhere('i.prioridadEnvio = :prioridad', { prioridad });
    return qb.getMany();
  }

  // =============================================
  // UTILIDADES
  // =============================================

  private getQrSigningSecret(tenantId: string): string {
    // En producción, esta clave debería venir de la configuración del tenant (siigo_config o tabla dedicada)
    // Por ahora usamos una clave derivada del tenantId + secreto global
    const globalSecret = process.env.QR_SIGNING_SECRET || 'oikos-qr-global-secret-2026';
    return `${globalSecret}-${tenantId}`;
  }
}