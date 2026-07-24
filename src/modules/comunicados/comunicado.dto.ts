import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { Comunicado } from './comunicado.entity';

export enum ComunicadoTipo {
  INFORMATIVO = 'informativo',
  URGENTE = 'urgente',
  EVENTO = 'evento',
  MANTENIMIENTO_PROGRAMADO = 'mantenimiento_programado',
}

export class CreateComunicadoDto {
  @ApiProperty({ example: 'Corte de agua programado' })
  @IsString()
  titulo: string;

  @ApiProperty({ example: 'Se informa que el próximo martes...' })
  @IsString()
  contenido: string;

  @ApiPropertyOptional({ enum: ComunicadoTipo, default: ComunicadoTipo.INFORMATIVO })
  @IsOptional()
  @IsEnum(ComunicadoTipo)
  tipo?: ComunicadoTipo = ComunicadoTipo.INFORMATIVO;

  @ApiPropertyOptional({ example: '2025-01-15T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  fechaPublicacion?: Date;

  @ApiPropertyOptional({ example: '2025-01-20T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  fechaExpiracion?: Date | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateComunicadoDto extends PartialType(CreateComunicadoDto) {}

export class ComunicadoListQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ComunicadoTipo })
  @IsOptional()
  @IsEnum(ComunicadoTipo)
  tipo?: ComunicadoTipo;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  soloVigentes?: boolean = false;
}

export interface ComunicadoListResponse {
  data: Comunicado[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}