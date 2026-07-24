import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '@modules/tenants/tenant.entity';
import { User } from '@modules/usuarios/user.entity';
import { Pqrs } from './pqrs.entity';
@Entity('pqrs_seguimientos')
@Index(['tenantId', 'pqrsId'])
@Index(['tenantId', 'usuarioId'])
@Index(['pqrsId', 'creadoEn'])
export class PqrsSeguimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'pqrs_id' })
  pqrsId: string;

  @ManyToOne(() => Pqrs, (p) => p.seguimientos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pqrs_id' })
  pqrs: Pqrs;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'text' })
  comentario: string;

  @Column({ name: 'es_interno', default: false })
  esInterno: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}