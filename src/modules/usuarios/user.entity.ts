import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum UserRole {
  PROPIETARIO = 'propietario',
  RESIDENTE = 'residente',
  PORTERO = 'portero',
  ADMIN = 'admin',
  JUNTA = 'junta',
  REVISOR_FISCAL = 'revisor_fiscal',
  SUPERADMIN = 'superadmin',
}

export enum UserUnitRelationshipType {
  PROPIETARIO = 'propietario',
  ARRENDATARIO = 'arrendatario',
  RESIDENTE_AUTORIZADO = 'residente_autorizado',
}

@Entity('roles')
@Unique(['nombre', 'tenant_id'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  nombre: string;

  @Column({ type: 'enum', enum: UserRole, unique: false })
  tipo: UserRole;

  @Column({ length: 255, nullable: true })
  descripcion: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string;

  @Column({ default: false })
  es_global: boolean;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;
}

@Entity('usuarios')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  password_hash: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  apellido: string;

  @Column({ length: 20, nullable: true })
  telefono: string;

  @Column({ length: 500, nullable: true })
  foto_url: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ default: false })
  email_verificado: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  ultimo_acceso: Date;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'usuario_roles',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToMany(() => UserUnit, (userUnit) => userUnit.usuario)
  unidades: UserUnit[];

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;

  get nombre_completo(): string {
    return this.apellido ? `${this.nombre} ${this.apellido}` : this.nombre;
  }

  hasRole(roleType: UserRole): boolean {
    return this.roles.some((r) => r.tipo === roleType);
  }

  isSuperAdmin(): boolean {
    return this.hasRole(UserRole.SUPERADMIN);
  }

  hasTenantRole(tenantId: string): boolean {
    return this.roles.some(
      (r) => r.tenant_id === tenantId || r.es_global === true,
    );
  }
}

@Entity('usuario_unidades')
@Unique(['usuario_id', 'unidad_id', 'tipo_relacion'])
export class UserUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuario_id: string;

  @Column({ name: 'unidad_id', type: 'uuid' })
  unidad_id: string;

  @Column({
    name: 'tipo_relacion',
    type: 'enum',
    enum: UserUnitRelationshipType,
  })
  tipo_relacion: UserUnitRelationshipType;

  @Column({ name: 'es_principal', default: false })
  es_principal: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_inicio: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_fin: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creado_en: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizado_en: Date;

  @ManyToOne(() => User, (user) => user.unidades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;
}