import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('correspondencia')
@Index(['tenantId', 'localUuid'], { unique: true })
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'porteroReceptorId'])
@Index(['tenantId', 'entregadoEn'])
export class Correspondencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'unidad_id' })
  @Index()
  unidadId: string;

  @Column({ length: 30 })
  tipo: string; // carta | paquete | encomienda | documento

  @Column({ length: 500, nullable: true })
  fotoUrl: string;

  @Column({ type: 'uuid', name: 'portero_receptor_id' })
  @Index()
  porteroReceptorId: string;

  @Column({ type: 'timestamptz', name: 'recibido_en' })
  recibidoEn: Date;

  @Column({ type: 'timestamptz', name: 'entregado_en', nullable: true })
  entregadoEn: Date;

  @Column({ length: 1000, name: 'firma_digital', nullable: true })
  firmaDigital: string; // base64 de la firma

  @Column({ length: 50, nullable: true, name: 'recibido_por' })
  recibidoPor: string;

  @Column({ length: 50, unique: true, name: 'local_uuid' })
  @Index()
  localUuid: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}