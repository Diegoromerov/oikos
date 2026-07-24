import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  ValidateIf,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantType } from '../tenant.entity';

export class SiigoConfigDto {
  @IsEnum(['nube', 'contabilidad'])
  tipo: 'nube' | 'contabilidad';

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  empresaId?: string;

  @IsOptional()
  @IsBoolean()
  sincronizacionAutomatica?: boolean;

  @IsOptional()
  @IsEnum(['diaria', 'semanal', 'mensual'])
  frecuenciaSincronizacion?: 'diaria' | 'semanal' | 'mensual';
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsEmail()
  @IsNotEmpty()
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
  @Min(0)
  total_unidades?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coeficiente_total?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SiigoConfigDto)
  siigo_config?: SiigoConfigDto;

  @IsOptional()
  @IsDateString()
  fecha_corte_migracion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  configuracion?: Record<string, any>;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

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
  @Min(0)
  total_unidades?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coeficiente_total?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SiigoConfigDto)
  siigo_config?: SiigoConfigDto;

  @IsOptional()
  @IsDateString()
  fecha_corte_migracion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  configuracion?: Record<string, any>;
}