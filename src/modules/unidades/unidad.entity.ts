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
import { Tenant } from '../tenants/tenant.entity';

export enum UnidadTipo {
  APARTAMENTO = 'apartamento',
  PARQUEADERO = 'parqueadero',
  DEPOSITO = 'deposito',
  LOCAL = 'local',
}

@Entity('unidades')
@Index(['tenant_id', 'torre', 'bloque', 'numero'], { unique: true })
@Index(['tenant_id', 'activo'])
export class Unidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 50 })
  torre: string;

  @Column({ length: 50, nullable: true })
  bloque: string;

  @Column({ length: 50 })
  numero: string;

  @Column({
    name: 'tipo_unidad',
    type: 'enum',
    enum: UnidadTipo,
    default: UnidadTipo.APARTAMENTO,
  })
  tipo_unidad: UnidadTipo;

  @Column({ name: 'area_privada', type: 'numeric', precision: 10, scale: 2, default: 0 })
  area_privada: number;

  @Column({
    name: 'coeficiente_copropiedad',
    type: 'numeric',
    precision: 10,
    scale: 8,
    default: 0,
  })
  coeficiente_copropiedad: number;

  @Column({ name: 'cuota_base', type: 'numeric', precision: 12, scale: 2, default: 0 })
  cuota_base: number;

  @Column({ name: 'piso', type: 'int', nullable: true })
  piso: number;

  @Column({ name: 'es_estudio', default: false })
  es_estudio: boolean;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;

  // Computed property for display
  get identificador(): string {
    return `${this.torre}${this.bloque ? '-' + this.bloque : ''}-${this.numero}`;
  }
}