import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('registros_acceso')
@Index(['tenantId', 'localUuid'], { unique: true })
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'porteroId'])
@Index(['tenantId', 'sincronizadoEn'])
export class RegistroAcceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'unidad_id' })
  @Index()
  unidadId: string;

  @Column({ type: 'uuid', name: 'visitante_preautorizado_id', nullable: true })
  visitantePreautorizadoId: string;

  // Datos manuales si no hubo preautorización
  @Column({ length: 200, nullable: true })
  nombreVisitante: string;

  @Column({ length: 50, nullable: true })
  documentoVisitante: string;

  @Column({ length: 30 })
  tipo: string; // peatonal | vehicular

  @Column({ length: 20, nullable: true })
  placa: string;

  @Column({ length: 20 })
  direccion: string; // entrada | salida

  @Column({ type: 'uuid', name: 'portero_id' })
  @Index()
  porteroId: string;

  @Column({ type: 'timestamptz', name: 'timestamp_local' })
  timestampLocal: Date;

  @Column({ type: 'timestamptz', name: 'sincronizado_en', nullable: true })
  sincronizadoEn: Date;

  @Column({ length: 100, name: 'device_id' })
  deviceId: string;

  @Column({ length: 50, unique: true, name: 'local_uuid' })
  @Index()
  localUuid: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}