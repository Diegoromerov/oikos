import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { encryptionService } from '@core/encryption/encryption.service';

export enum TenantType {
  CONJUNTO_RESIDENCIAL = 'conjunto_residencial',
  CONJUNTO_COMERCIAL = 'conjunto_comercial',
  MIXTO = 'mixto',
}

export enum TenantStatus {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
  EN_MIGRACION = 'en_migracion',
  SUSPENDIDO = 'suspendido',
}

export interface SiigoConfig {
  tipo: 'nube' | 'contabilidad';
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  baseUrl?: string;
  empresaId?: string;
  sincronizacionAutomatica?: boolean;
  frecuenciaSincronizacion?: 'diaria' | 'semanal' | 'mensual';
}

@Entity('tenants')
@Index(['slug'], { unique: true })
@Index(['emailContacto'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ length: 255, name: 'email_contacto' })
  emailContacto: string;

  @Column({ length: 20, name: 'telefono_contacto', nullable: true })
  telefonoContacto: string;

  @Column({ type: 'text', nullable: true })
  direccion: string;

  @Column({
    type: 'enum',
    enum: TenantType,
    default: TenantType.CONJUNTO_RESIDENCIAL,
  })
  tipo: TenantType;

  @Column({ type: 'int', default: 0, name: 'total_unidades' })
  totalUnidades: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'coeficiente_total',
  })
  coeficienteTotal: number;

  @Column({ type: 'jsonb', name: 'siigo_config', nullable: true })
  siigoConfig: SiigoConfig;

  @Column({
    type: 'timestamp with time zone',
    name: 'fecha_corte_migracion',
    nullable: true,
  })
  fechaCorteMigracion: Date;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.ACTIVO,
  })
  estado: TenantStatus;

  @Column({ type: 'jsonb', default: '{}' })
  configuracion: Record<string, any>;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;

  // Encrypt sensitive siigo_config fields before saving
  setSiigoConfig(config: SiigoConfig): void {
    this.siigoConfig = encryptionService.encryptObject(
      config as Record<string, any>,
    ) as SiigoConfig;
  }

  // Decrypt siigo_config for reading
  getSiigoConfig(): SiigoConfig | null {
    if (!this.siigoConfig) return null;
    return encryptionService.decryptObject(
      this.siigoConfig as Record<string, any>,
    ) as SiigoConfig;
  }
}