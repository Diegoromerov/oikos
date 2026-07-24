import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('minutas_turno')
@Index(['tenantId', 'porteroId', 'turnoInicio'])
@Index(['localUuid'], { unique: true })
export class MinutaTurno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'portero_id' })
  @Index()
  porteroId: string;

  @Column({ type: 'timestamptz', name: 'turno_inicio' })
  turnoInicio: Date;

  @Column({ type: 'timestamptz', name: 'turno_fin', nullable: true })
  turnoFin: Date;

  @Column({ type: 'text', nullable: true })
  novedades: string;

  @Column({ length: 100, unique: true, name: 'local_uuid' })
  @Index()
  localUuid: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}