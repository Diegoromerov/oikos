import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('visitantes_preautorizados')
@Index(['tenantId', 'qrCode'], { unique: true })
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'validoHasta'])
export class VisitantesPreautorizados {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'unidad_id' })
  @Index()
  unidadId: string;

  @Column({ type: 'uuid', name: 'autorizado_por', nullable: true })
  autorizadoPor: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 50, nullable: true })
  documento: string;

  @Column({ length: 30 })
  tipo: string; // visitante | domicilio | servicio | proveedor

  @Column({ length: 500, nullable: true })
  observaciones: string;

  @Column({ unique: true, name: 'qr_code', length: 100 })
  qrCode: string;

  @Column({ type: 'timestamptz', name: 'valido_desde' })
  validoDesde: Date;

  @Column({ type: 'timestamptz', name: 'valido_hasta' })
  validoHasta: Date;

  @Column({ type: 'timestamptz', name: 'usado_en', nullable: true })
  usadoEn: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}