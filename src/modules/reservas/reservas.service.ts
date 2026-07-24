import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZonaComun } from './zona-comun.entity';
import { Reserva, ReservaEstado } from './reserva.entity';

interface CreateReservaDto {
  zonaComunId: string;
  unidadId: string;
  fecha: string; // ISO string, will be converted to Date for DB queries
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm
  observaciones?: string;
}

interface UpdateReservaDto {
  estado?: ReservaEstado;
  observaciones?: string;
}

interface DisponibilidadSlot {
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  reservaId?: string;
}

interface CreateZonaComunDto {
  nombre: string;
  descripcion?: string;
  capacidadMaxima: number;
  costo?: number;
  requiereAprobacion?: boolean;
  horarioDisponible: Record<string, { inicio: string; fin: string }[]>;
}

interface UpdateZonaComunDto {
  nombre?: string;
  descripcion?: string;
  capacidadMaxima?: number;
  costo?: number;
  requiereAprobacion?: boolean;
  horarioDisponible?: Record<string, { inicio: string; fin: string }[]>;
  activo?: boolean;
}

@Injectable()
export class ReservasService {
  constructor(
    @InjectRepository(ZonaComun)
    private readonly zonaComunRepo: Repository<ZonaComun>,
    @InjectRepository(Reserva)
    private readonly reservaRepo: Repository<Reserva>,
  ) {}

  // ===========================================
  // ZONAS COMUNES
  // ===========================================

  async crearZonaComun(tenantId: string, dto: CreateZonaComunDto): Promise<ZonaComun> {
    const zona = this.zonaComunRepo.create({ ...dto, tenantId });
    return this.zonaComunRepo.save(zona);
  }

  async listarZonasComunes(tenantId: string, soloActivas = true): Promise<ZonaComun[]> {
    const qb = this.zonaComunRepo
      .createQueryBuilder('z')
      .where('z.tenantId = :tenantId', { tenantId })
      .orderBy('z.nombre', 'ASC');

    if (soloActivas) qb.andWhere('z.activo = true');

    return qb.getMany();
  }

  async obtenerZonaComun(id: string, tenantId: string): Promise<ZonaComun> {
    const zona = await this.zonaComunRepo.findOne({ where: { id, tenantId } });
    if (!zona) throw new NotFoundException('Zona común no encontrada');
    return zona;
  }

  async actualizarZonaComun(id: string, tenantId: string, dto: UpdateZonaComunDto): Promise<ZonaComun> {
    const zona = await this.obtenerZonaComun(id, tenantId);
    Object.assign(zona, dto);
    return this.zonaComunRepo.save(zona);
  }

  async eliminarZonaComun(id: string, tenantId: string): Promise<void> {
    const zona = await this.obtenerZonaComun(id, tenantId);
    // Soft delete: solo desactivar si tiene reservas futuras
    const reservasFuturas = await this.reservaRepo.count({
      where: { zonaComunId: id, tenantId, estado: ReservaEstado.CONFIRMADA },
    });
    if (reservasFuturas > 0) {
      zona.activo = false;
      await this.zonaComunRepo.save(zona);
    } else {
      await this.zonaComunRepo.remove(zona);
    }
  }

  // ===========================================
  // RESERVAS
  // ===========================================

  async crearReserva(userId: string, tenantId: string, dto: CreateReservaDto): Promise<Reserva> {
    // Verificar zona existe y está activa
    const zona = await this.obtenerZonaComun(dto.zonaComunId, tenantId);
    if (!zona.activo) throw new BadRequestException('Zona común no disponible');

    // Verificar no solapamiento (DB constraint también protege, pero validamos antes para mejor UX)
    const solapada = await this.verificarSolapamiento(
      dto.zonaComunId,
      dto.fecha,
      dto.horaInicio,
      dto.horaFin,
      tenantId,
    );
    if (solapada) throw new ConflictException('Ya existe una reserva confirmada en ese horario');

    // Determinar estado inicial
    const estadoInicial = zona.requiereAprobacion ? ReservaEstado.PENDIENTE : ReservaEstado.CONFIRMADA;

    // costo_aplicado se setea por trigger en BD

    const reserva = this.reservaRepo.create({
      ...dto,
      zonaComunId: dto.zonaComunId,
      usuarioId: userId,
      tenantId,
      estado: estadoInicial,
      // costoAplicado: set by DB trigger
    });

    return this.reservaRepo.save(reserva);
  }

  async listarReservas(
    tenantId: string,
    filters?: { zonaComunId?: string; unidadId?: string; estado?: ReservaEstado; fechaDesde?: string; fechaHasta?: string },
    isAdmin = false,
    userId?: string,
  ): Promise<Reserva[]> {
    const qb = this.reservaRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.zonaComun', 'zc')
      .leftJoinAndSelect('r.usuario', 'u')
      .where('r.tenantId = :tenantId', { tenantId })
      .orderBy('r.fecha', 'DESC')
      .addOrderBy('r.horaInicio', 'ASC');

    if (!isAdmin && userId) {
      qb.andWhere('r.usuarioId = :userId', { userId });
    }

    if (filters?.zonaComunId) qb.andWhere('r.zonaComunId = :zonaComunId', { zonaComunId: filters.zonaComunId });
    if (filters?.unidadId) qb.andWhere('r.unidadId = :unidadId', { unidadId: filters.unidadId });
    if (filters?.estado) qb.andWhere('r.estado = :estado', { estado: filters.estado });
    if (filters?.fechaDesde) qb.andWhere('r.fecha >= :fechaDesde', { fechaDesde: filters.fechaDesde });
    if (filters?.fechaHasta) qb.andWhere('r.fecha <= :fechaHasta', { fechaHasta: filters.fechaHasta });

    return qb.getMany();
  }

  async obtenerReserva(id: string, tenantId: string): Promise<Reserva> {
    const reserva = await this.reservaRepo.findOne({
      where: { id, tenantId },
      relations: ['zonaComun', 'usuario', 'aprobadoPor'],
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  async actualizarReserva(id: string, tenantId: string, dto: UpdateReservaDto, userId: string): Promise<Reserva> {
    const reserva = await this.obtenerReserva(id, tenantId);
    const oldEstado = reserva.estado;

    Object.assign(reserva, dto);
    const saved = await this.reservaRepo.save(reserva);

    // If admin confirms/rejects
    if (dto.estado && dto.estado !== oldEstado && [ReservaEstado.CONFIRMADA, ReservaEstado.RECHAZADA].includes(dto.estado)) {
      saved.aprobadoPorId = userId;
      saved.fechaAprobacion = new Date();
      await this.reservaRepo.save(saved);
    }

    return saved;
  }

  async cancelarReserva(id: string, tenantId: string, userId: string, esAdmin = false): Promise<Reserva> {
    const reserva = await this.obtenerReserva(id, tenantId);

    if (!esAdmin && reserva.usuarioId !== userId) {
      throw new BadRequestException('No puede cancelar reserva de otra persona');
    }

    if (reserva.estado === ReservaEstado.CANCELADA || reserva.estado === ReservaEstado.RECHAZADA) {
      throw new BadRequestException('Reserva ya no se puede cancelar');
    }

    reserva.estado = ReservaEstado.CANCELADA;
    return this.reservaRepo.save(reserva);
  }

  async getDisponibilidad(zonaComunId: string, fecha: string, tenantId: string): Promise<DisponibilidadSlot[]> {
    const zona = await this.obtenerZonaComun(zonaComunId, tenantId);
    const diaSemana = this.getDiaSemana(new Date(fecha));
    const horarios = zona.horarioDisponible[diaSemana] || [];
    const fechaDate = new Date(fecha);

    // Get confirmed reservations for that date
    const reservas = await this.reservaRepo.find({
      where: {
        zonaComunId,
        tenantId,
        fecha: fechaDate,
        estado: ReservaEstado.CONFIRMADA,
      },
    });

    // Build slots based on zone's available hours
    const slots: DisponibilidadSlot[] = [];
    for (const h of horarios) {
      let ocupado = false;
      let reservaId: string | undefined;

      // Check if any reservation overlaps this slot
      for (const r of reservas) {
        if (this.timeOverlaps(h.inicio, h.fin, r.horaInicio, r.horaFin)) {
          ocupado = true;
          reservaId = r.id;
          break;
        }
      }

      slots.push({
        horaInicio: h.inicio,
        horaFin: h.fin,
        disponible: !ocupado,
        reservaId,
      });
    }

    return slots;
  }

  private async verificarSolapamiento(
    zonaComunId: string,
    fecha: string,
    horaInicio: string,
    horaFin: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const fechaDate = new Date(fecha);
    const qb = this.reservaRepo
      .createQueryBuilder('r')
      .where('r.zonaComunId = :zonaComunId', { zonaComunId })
      .andWhere('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.fecha = :fecha', { fecha: fechaDate })
      .andWhere('r.estado = :estado', { estado: ReservaEstado.CONFIRMADA })
      .andWhere('tsrange(r.horaInicio, r.horaFin) && tsrange(:inicio, :fin)', { inicio: horaInicio, fin: horaFin });

    if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId: excludeId });

    const count = await qb.getCount();
    return count > 0;
  }

  private getDiaSemana(fecha: Date): string {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dias[fecha.getDay()];
  }

  private timeOverlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart < bEnd && bStart < aEnd;
  }
}

interface CreateZonaComunDto {
  nombre: string;
  descripcion?: string;
  capacidadMaxima: number;
  costo?: number;
  requiereAprobacion?: boolean;
  horarioDisponible: Record<string, { inicio: string; fin: string }[]>;
}

interface UpdateZonaComunDto {
  nombre?: string;
  descripcion?: string;
  capacidadMaxima?: number;
  costo?: number;
  requiereAprobacion?: boolean;
  horarioDisponible?: Record<string, { inicio: string; fin: string }[]>;
  activo?: boolean;
}