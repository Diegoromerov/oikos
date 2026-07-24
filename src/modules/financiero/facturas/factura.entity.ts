import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Unidad } from '../../unidades/unidad.entity';
import { Pago } from '../pagos/pago.entity';

export enum FacturaTipo {
  ORDINARIA = 'ordinaria',
  EXTRAORDINARIA = 'extraordinaria',
}

export enum FacturaEstadoSync {
  PENDIENTE = 'pendiente',
  SINCRONIZADO = 'sincronizado',
  ERROR = 'error',
}

@Entity('facturas')
@Index(['tenant_id', 'unidad_id', 'periodo', 'tipo'], { unique: true })
@Index(['tenant_id', 'estado_sync'])
@Index(['tenant_id', 'fecha_vencimiento'])
export class Factura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenant_id: string;

  @Column({ name: 'unidad_id', type: 'uuid' })
  unidad_id: string;

  @ManyToOne(() => Unidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({
    type: 'enum',
    enum: FacturaTipo,
    default: FacturaTipo.ORDINARIA,
  })
  tipo: FacturaTipo;

  @Column({ length: 7 }) // YYYY-MM
  periodo: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  @Column({ name: 'fecha_emision', type: 'date' })
  fecha_emision: Date;

  @Column({ name: 'fecha_vencimiento', type: 'date' })
  fecha_vencimiento: Date;

  @Column({
    name: 'estado_sync',
    type: 'enum',
    enum: FacturaEstadoSync,
    default: FacturaEstadoSync.PENDIENTE,
  })
  estado_sync: FacturaEstadoSync;

  @Column({ name: 'siigo_factura_id', nullable: true, length: 100 })
  siigo_factura_id: string;

  @Column({ name: 'error_sync', type: 'text', nullable: true })
  error_sync: string;

  @Column({ name: 'intentos_sync', default: 0 })
  intentos_sync: number;

  @Column({ name: 'ultimo_intento_sync', type: 'timestamptz', nullable: true })
  ultimo_intento_sync: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;

  @OneToMany(() => Pago, (pago) => pago.factura)
  pagos: Pago[];

  // Computed properties
  get total_pagado(): number {
    return this.pagos?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;
  }

  get saldo_pendiente(): number {
    return Number(this.monto) - this.total_pagado;
  }

  get esta_vencida(): boolean {
    return new Date() > this.fecha_vencimiento && this.saldo_pendiente > 0;
  }

  get esta_pagada(): boolean {
    return this.saldo_pendiente <= 0;
  }
}