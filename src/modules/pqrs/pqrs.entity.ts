import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '@modules/tenants/tenant.entity';
import { Unidad } from '@modules/unidades/unidad.entity';
import { User } from '@modules/usuarios/user.entity';
import { PqrsSeguimiento } from './pqrs-seguimiento.entity';

export enum PqrsTipo {
  PETICION = 'peticion',
  QUEJA = 'queja',
  RECLAMO = 'reclamo',
  SUGERENCIA = 'sugerencia',
}

export enum PqrsPrioridad {
  URGENTE = 'urgente',
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
}

export enum PqrsEstado {
  ABIERTO = 'abierto',
  EN_PROCESO = 'en_proceso',
  RESUELTO = 'resuelto',
  CERRADO = 'cerrado',
  RECHAZADO = 'rechazado',
  REABIERTO = 'reabierto',
}

@Entity('pqrs')
@Index(['tenantId', 'estado'])
@Index(['tenantId', 'tipo'])
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'usuarioId'])
@Index(['tenantId', 'slaFechaLimite'])
export class Pqrs {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'enum', enum: PqrsTipo })
  tipo: PqrsTipo;

  @Column({ type: 'enum', enum: PqrsPrioridad })
  prioridad: PqrsPrioridad;

  @Column({ type: 'enum', enum: PqrsEstado, default: PqrsEstado.ABIERTO })
  estado: PqrsEstado;

  @Column({ length: 200 })
  asunto: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'uuid', name: 'unidad_id', nullable: true })
  unidadId: string;

  @ManyToOne(() => Unidad)
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'uuid', name: 'asignado_a', nullable: true })
  asignadoA: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'asignado_a' })
  asignado: User;

  @Column({ type: 'timestamptz', name: 'sla_fecha_limite' })
  slaFechaLimite: Date;

  @Column({ type: 'timestamptz', name: 'fecha_resolucion', nullable: true })
  fechaResolucion: Date;

  @OneToMany(() => PqrsSeguimiento, (seg) => seg.pqrs)
  seguimientos: PqrsSeguimiento[];

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}