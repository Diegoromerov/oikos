import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ZonaComun } from './zona-comun.entity';
import { User } from '@modules/usuarios/user.entity';
import { Unidad } from '@modules/unidades/unidad.entity';

export enum ReservaEstado {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  RECHAZADA = 'rechazada',
  CANCELADA = 'cancelada',
}

@Entity('reservas')
@Index(['tenantId', 'estado'])
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'usuarioId'])
@Index(['tenantId', 'fecha'])
// Exclusion constraint for no-overlap: will be added in migration via raw SQL
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'zona_comun_id' })
  zonaComunId: string;

  @ManyToOne(() => ZonaComun)
  @JoinColumn({ name: 'zona_comun_id' })
  zonaComun: ZonaComun;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad)
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  @Column({
    name: 'costo_aplicado',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costoAplicado: number;

  @Column({
    type: 'enum',
    enum: ReservaEstado,
    default: ReservaEstado.PENDIENTE,
  })
  estado: ReservaEstado;

  @Column({ type: 'uuid', name: 'aprobado_por_id', nullable: true })
  aprobadoPorId: string;

  @Column({ name: 'fecha_aprobacion', type: 'timestamptz', nullable: true })
  fechaAprobacion: Date;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}