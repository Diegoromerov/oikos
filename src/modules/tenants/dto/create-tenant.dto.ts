import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { TenantType } from '../tenant.entity';
import { SiigoConfig } from '../tenant.entity';

export class CreateTenantDto {
  @IsString()
  nombre: string;

  @IsString()
  slug: string;

  @IsEmail()
  email_contacto: string;

  @IsOptional()
  @IsString()
  telefono_contacto?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsEnum(TenantType)
  tipo?: TenantType;

  @IsOptional()
  @IsNumber()
  total_unidades?: number;

  @IsOptional()
  @IsNumber()
  coeficiente_total?: number;

  @IsOptional()
  siigo_config?: SiigoConfig;

  @IsOptional()
  fecha_corte_migracion?: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  configuracion?: Record<string, any>;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail()
  email_contacto?: string;

  @IsOptional()
  @IsString()
  telefono_contacto?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsEnum(TenantType)
  tipo?: TenantType;

  @IsOptional()
  @IsNumber()
  total_unidades?: number;

  @IsOptional()
  @IsNumber()
  coeficiente_total?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  configuracion?: Record<string, any>;
}