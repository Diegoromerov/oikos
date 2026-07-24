import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  Min,
  Max,
  ValidateIf,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UnidadTipo } from '../unidad.entity';

export class CreateUnidadDto {
  @IsString()
  @IsNotEmpty()
  torre: string;

  @IsOptional()
  @IsString()
  bloque?: string;

  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsEnum(UnidadTipo)
  tipo_unidad: UnidadTipo;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  area_privada?: number;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  @Max(100)
  coeficiente_copropiedad: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cuota_base?: number;

  @IsOptional()
  @IsNumber()
  piso?: number;

  @IsOptional()
  @ValidateIf((o) => o.es_estudio !== undefined)
  es_estudio?: boolean;
}

export class UpdateUnidadDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  torre?: string;

  @IsOptional()
  @IsString()
  bloque?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numero?: string;

  @IsOptional()
  @IsEnum(UnidadTipo)
  tipo_unidad?: UnidadTipo;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  area_privada?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  @Max(100)
  coeficiente_copropiedad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cuota_base?: number;

  @IsOptional()
  @IsNumber()
  piso?: number;

  @IsOptional()
  es_estudio?: boolean;

  @IsOptional()
  activo?: boolean;
}

export class BulkUnidadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnidadDto)
  unidades: CreateUnidadDto[];
}

export class CoeficienteValidationResult {
  total: number;
  expected: number;
  isValid: boolean;
  difference: number;
  warning?: string;
}