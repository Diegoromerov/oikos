import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '@modules/tenants/tenant.entity';

export class HorarioDia {
  inicio: string;
  fin: string;
}

export type HorarioDisponible = Record<string, HorarioDia[]>;

@Entity('zonas_comunes')
@Index(['tenantId', 'activo'])
export class ZonaComun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 100 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ name: 'capacidad_maxima', default: 1 })
  capacidadMaxima: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  costo: number;

  @Column({ name: 'requiere_aprobacion', default: true })
  requiereAprobacion: boolean;

  @Column({ name: 'horario_disponible', type: 'jsonb', default: '{}' })
  horarioDisponible: HorarioDisponible;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}