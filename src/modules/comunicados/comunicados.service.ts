import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comunicado } from './comunicado.entity';
import { CreateComunicadoDto, UpdateComunicadoDto, ComunicadoListQuery, ComunicadoListResponse } from './comunicado.dto';

export type { ComunicadoListQuery, ComunicadoListResponse };

@Injectable()
export class ComunicadosService {
  constructor(
    @InjectRepository(Comunicado)
    private readonly comunicadoRepository: Repository<Comunicado>,
  ) {}

  async crear(
    dto: CreateComunicadoDto,
    tenantId: string,
    usuarioId: string,
  ): Promise<Comunicado> {
    const comunicado = this.comunicadoRepository.create({
      ...dto,
      tenantId,
      publicadoPorId: usuarioId,
      fechaPublicacion: dto.fechaPublicacion || new Date(),
      activo: dto.activo ?? true,
    });
    return this.comunicadoRepository.save(comunicado);
  }

  async listar(
    tenantId: string,
    query: ComunicadoListQuery,
  ): Promise<ComunicadoListResponse> {
    const { page = 1, limit = 20, tipo, soloVigentes } = query;
    const skip = (page - 1) * limit;

    const qb = this.comunicadoRepository
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });

    if (tipo) {
      qb.andWhere('c.tipo = :tipo', { tipo });
    }

    if (soloVigentes) {
      const now = new Date();
      qb.andWhere('c.activo = true')
        .andWhere(
          '(c.fecha_expiracion IS NULL OR c.fecha_expiracion > :now)',
          { now },
        )
        .andWhere('c.fecha_publicacion <= :now', { now });
    }

    const [data, total] = await qb
      .orderBy('c.fecha_publicacion', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listarParaResidente(
    tenantId: string,
    query: ComunicadoListQuery,
  ): Promise<ComunicadoListResponse> {
    // Residentes solo ven comunicados activos y vigentes
    return this.listar(tenantId, { ...query, soloVigentes: true });
  }

  async obtenerPorId(id: string, tenantId: string): Promise<Comunicado> {
    const comunicado = await this.comunicadoRepository.findOne({
      where: { id, tenantId },
    });

    if (!comunicado) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    return comunicado;
  }

  async actualizar(
    id: string,
    tenantId: string,
    dto: UpdateComunicadoDto,
  ): Promise<Comunicado> {
    const comunicado = await this.obtenerPorId(id, tenantId);
    Object.assign(comunicado, dto);
    return this.comunicadoRepository.save(comunicado);
  }

  async eliminar(id: string, tenantId: string): Promise<void> {
    const comunicado = await this.obtenerPorId(id, tenantId);
    await this.comunicadoRepository.remove(comunicado);
  }
}