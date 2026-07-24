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
import { User } from '@modules/usuarios/user.entity';

@Entity('comunicados')
@Index(['tenantId', 'fechaPublicacion'])
@Index(['tenantId', 'fechaExpiracion'], { where: 'fecha_expiracion IS NOT NULL' })
@Index(['tenantId', 'activo'])
export class Comunicado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid', name: 'publicado_por_id' })
  publicadoPorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'publicado_por_id' })
  publicadoPor: User;

  @Column({ length: 200 })
  titulo: string;

  @Column('text')
  cuerpo: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'informativo',
  })
  tipo: 'informativo' | 'urgente' | 'evento' | 'mantenimiento_programado';

  @Column({
    type: 'varchar',
    length: 10,
    default: 'normal',
    name: 'prioridad',
  })
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';

  @Column({ type: 'timestamptz', name: 'fecha_publicacion', default: () => 'NOW()' })
  fechaPublicacion: Date;

  @Column({ type: 'timestamptz', name: 'fecha_expiracion', nullable: true })
  fechaExpiracion: Date | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'jsonb', nullable: true })
  adjuntos: Array<{ nombre: string; url: string; tipo: string }> | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}