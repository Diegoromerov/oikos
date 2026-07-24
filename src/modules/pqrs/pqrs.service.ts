import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Pqrs } from './pqrs.entity';
import { PqrsSeguimiento } from './pqrs-seguimiento.entity';
import { PqrsTipo, PqrsPrioridad, PqrsEstado } from './pqrs.entity';

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

@Injectable()
export class PqrsService {
  constructor(
    @InjectRepository(Pqrs)
    private readonly pqrsRepo: Repository<Pqrs>,
    @InjectRepository(PqrsSeguimiento)
    private readonly seguimientoRepo: Repository<PqrsSeguimiento>,
  ) {}

  async create(userId: string, tenantId: string, dto: CreatePqrsDto): Promise<Pqrs> {
    const pqrs = this.pqrsRepo.create({
      ...dto,
      usuarioId: userId,
      tenantId,
      // sla_fecha_limite set by DB trigger
    });
    return this.pqrsRepo.save(pqrs);
  }

  async findAll(
    tenantId: string,
    filters?: { estado?: PqrsEstado; tipo?: PqrsTipo; unidadId?: string; usuarioId?: string },
    isAdmin = false,
    userId?: string,
  ): Promise<Pqrs[]> {
    const qb = this.pqrsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.unidad', 'u')
      .leftJoinAndSelect('p.usuario', 'usr')
      .leftJoinAndSelect('p.asignado', 'asig')
      .where('p.tenantId = :tenantId', { tenantId })
      .orderBy('p.creadoEn', 'DESC');

    if (!isAdmin && userId) {
      qb.andWhere('p.usuarioId = :userId', { userId });
    }

    if (filters?.estado) qb.andWhere('p.estado = :estado', { estado: filters.estado });
    if (filters?.tipo) qb.andWhere('p.tipo = :tipo', { tipo: filters.tipo });
    if (filters?.unidadId) qb.andWhere('p.unidadId = :unidadId', { unidadId: filters.unidadId });
    if (filters?.usuarioId) qb.andWhere('p.usuarioId = :usuarioId', { usuarioId: filters.usuarioId });

    return qb.getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Pqrs> {
    const pqrs = await this.pqrsRepo.findOne({
      where: { id, tenantId },
      relations: ['unidad', 'usuario', 'asignado', 'seguimientos', 'seguimientos.usuario'],
    });
    if (!pqrs) throw new NotFoundException('PQRS no encontrado');
    return pqrs;
  }

  async update(id: string, tenantId: string, dto: UpdatePqrsDto, userId: string): Promise<Pqrs> {
    const pqrs = await this.findOne(id, tenantId);
    const oldEstado = pqrs.estado;

    Object.assign(pqrs, dto);
    const saved = await this.pqrsRepo.save(pqrs);

    // If estado changed, add seguimiento
    if (dto.estado && dto.estado !== oldEstado) {
      await this.addSeguimiento(
        id,
        tenantId,
        userId,
        `Estado cambiado de ${oldEstado} a ${dto.estado}`,
        true,
      );
    }

    return saved;
  }

  async addSeguimiento(
    pqrsId: string,
    tenantId: string,
    usuarioId: string,
    comentario: string,
    esInterno = false,
  ): Promise<PqrsSeguimiento> {
    await this.findOne(pqrsId, tenantId); // validates exists

    const seg = this.seguimientoRepo.create({
      pqrsId,
      tenantId,
      usuarioId,
      comentario,
      esInterno,
    });
    return this.seguimientoRepo.save(seg);
  }

  async getSeguimientos(pqrsId: string, tenantId: string, isAdmin: boolean): Promise<PqrsSeguimiento[]> {
    const qb = this.seguimientoRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.usuario', 'u')
      .where('s.pqrsId = :pqrsId', { pqrsId })
      .andWhere('s.tenantId = :tenantId', { tenantId })
      .orderBy('s.creadoEn', 'ASC');

    if (!isAdmin) {
      qb.andWhere('s.esInterno = false');
    }

    return qb.getMany();
  }

  async getVencidos(tenantId: string): Promise<Pqrs[]> {
    const ahora = new Date();
    return this.pqrsRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.fechaResolucion IS NULL')
      .andWhere('p.slaFechaLimite < :ahora', { ahora })
      .andWhere('p.estado NOT IN (:...estados)', { estados: [PqrsEstado.CERRADO, PqrsEstado.RECHAZADO] })
      .orderBy('p.slaFechaLimite', 'ASC')
      .getMany();
  }

  async getStats(tenantId: string): Promise<{
    total: number;
    porEstado: Record<string, number>;
    porPrioridad: Record<string, number>;
    vencidos: number;
  }> {
    const total = await this.pqrsRepo.count({ where: { tenantId } });
    const vencidos = await this.getVencidos(tenantId);

    const porEstado = await this.pqrsRepo
      .createQueryBuilder('p')
      .select('p.estado', 'estado')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .groupBy('p.estado')
      .getRawMany();

    const porPrioridad = await this.pqrsRepo
      .createQueryBuilder('p')
      .select('p.prioridad', 'prioridad')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .groupBy('p.prioridad')
      .getRawMany();

    return {
      total,
      vencidos: vencidos.length,
      porEstado: porEstado.reduce((acc, r) => ({ ...acc, [r.estado]: parseInt(r.count) }), {}),
      porPrioridad: porPrioridad.reduce((acc, r) => ({ ...acc, [r.prioridad]: parseInt(r.count) }), {}),
    };
  }
}