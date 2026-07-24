import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Unidad } from '@modules/unidades/unidad.entity';

@Entity('visitantes_preautorizados')
@Index(['tenantId', 'unidadId'])
@Index(['tenantId', 'validoDesde', 'validoHasta'])
export class VisitantePreautorizado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'unidad_id', type: 'uuid' })
  unidadId: string;

  @ManyToOne(() => Unidad)
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ name: 'autorizado_por_id', type: 'uuid' })
  autorizadoPorId: string;

  @Column({ name: 'nombre_visitante', length: 100 })
  nombreVisitante: string;

  @Column({ name: 'documento_visitante', length: 50, nullable: true })
  documentoVisitante: string;

  @Column({
    name: 'tipo_visitante',
    length: 30,
    default: 'visitante',
  })
  tipoVisitante: string; // 'visitante' | 'domicilio' | 'servicio' | 'proveedor'

  @Column({ name: 'qr_code', length: 100, unique: true })
  qrCode: string;

  @Column({ name: 'valido_desde', type: 'timestamptz' })
  validoDesde: Date;

  @Column({ name: 'valido_hasta', type: 'timestamptz' })
  validoHasta: Date;

  @Column({ name: 'usado_en', type: 'timestamptz', nullable: true })
  usadoEn: Date;

  @Column({ name: 'cancelado_en', type: 'timestamptz', nullable: true })
  canceladoEn: Date;

  @Column({ name: 'cancelado_por_id', type: 'uuid', nullable: true })
  canceladoPorId: string;

  @Column({ name: 'cancelado_motivo', length: 500, nullable: true })
  canceladoMotivo: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}