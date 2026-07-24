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
import { Factura } from '../facturas/factura.entity';
import { Unidad } from '../../unidades/unidad.entity';

export enum PagoMetodo {
  WOMPI = 'wompi',
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  NEQUI = 'nequi',
  DAVIPLATA = 'daviplata',
  OTRO = 'otro',
}

export enum PagoEstadoSync {
  PENDIENTE_SINCRONIZAR_SIIGO = 'pendiente_de_sincronizar_siigo',
  SINCRONIZADO = 'sincronizado',
  ERROR = 'error',
}

@Entity('pagos')
@Index(['tenant_id', 'estado_sync'])
@Index(['tenant_id', 'fecha'])
@Index(['wompi_transaction_id'], { unique: true, where: 'wompi_transaction_id IS NOT NULL' })
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenant_id: string;

  @Column({ name: 'factura_id', type: 'uuid' })
  factura_id: string;

  @ManyToOne(() => Factura, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'factura_id' })
  factura: Factura;

  @Column({ name: 'unidad_id', type: 'uuid' })
  unidad_id: string;

  @ManyToOne(() => Unidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  @Column({
    name: 'metodo_pago',
    type: 'enum',
    enum: PagoMetodo,
    default: PagoMetodo.WOMPI,
  })
  metodo_pago: PagoMetodo;

  @Column({ name: 'wompi_transaction_id', nullable: true, length: 100 })
  wompi_transaction_id: string;

  @Column({ name: 'wompi_reference', nullable: true, length: 100 })
  wompi_reference: string;

  @Column({ name: 'fecha', type: 'timestamptz', default: () => 'NOW()' })
  fecha: Date;

  @Column({
    name: 'estado_sync',
    type: 'enum',
    enum: PagoEstadoSync,
    default: PagoEstadoSync.PENDIENTE_SINCRONIZAR_SIIGO,
  })
  estado_sync: PagoEstadoSync;

  @Column({ name: 'siigo_pago_id', nullable: true, length: 100 })
  siigo_pago_id: string;

  @Column({ name: 'error_sync', type: 'text', nullable: true })
  error_sync: string;

  @Column({ name: 'intentos_sync', default: 0 })
  intentos_sync: number;

  @Column({ name: 'ultimo_intento_sync', type: 'timestamptz', nullable: true })
  ultimo_intento_sync: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;
}