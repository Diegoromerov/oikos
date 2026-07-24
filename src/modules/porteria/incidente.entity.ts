import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('incidentes')
@Index(['tenantId', 'porteroId', 'creadoEn'])
@Index(['tenantId', 'prioridadEnvio'])
@Index(['localUuid'], { unique: true })
export class Incidente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'portero_id' })
  @Index()
  porteroId: string;

  @Column({ length: 30, name: 'tipo_incidente' })
  tipoIncidente: string; // 'panico' | 'incidente' | 'mantenimiento_urgente'

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ length: 500, nullable: true, name: 'foto_url' })
  fotoUrl: string;

  @Column({ default: false, name: 'prioridad_envio' })
  prioridadEnvio: boolean;

  @Column({ length: 100, unique: true, name: 'local_uuid' })
  @Index()
  localUuid: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}