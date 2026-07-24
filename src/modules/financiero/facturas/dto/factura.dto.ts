import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsUUID,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FacturaTipo, FacturaEstadoSync } from '../factura.entity';

export class CreateFacturaDto {
  @IsUUID('4')
  @IsNotEmpty()
  unidad_id: string;

  @IsEnum(FacturaTipo)
  tipo: FacturaTipo;

  @Matches(/^\d{4}-\d{2}$/, { message: 'Periodo must be in YYYY-MM format' })
  @IsNotEmpty()
  periodo: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsDateString()
  fecha_emision?: string;

  @IsDateString()
  fecha_vencimiento: string;
}

export class BulkGenerateFacturasDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'Periodo must be in YYYY-MM format' })
  @IsNotEmpty()
  periodo: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unidad_ids?: string[]; // If not provided, generate for all active units
}

export class UpdateFacturaDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @IsOptional()
  @IsEnum(FacturaEstadoSync)
  estado_sync?: FacturaEstadoSync;
}

export class FacturaResponseDto {
  id: string;
  tenant_id: string;
  unidad_id: string;
  tipo: FacturaTipo;
  periodo: string;
  monto: number;
  fecha_emision: Date;
  fecha_vencimiento: Date;
  estado_sync: string;
  siigo_factura_id?: string;
  creado_en: Date;
  actualizado_en: Date;
}

export class EstadoCuentaResponseDto {
  unidadId: string;
  tenantId: string;
  totalPendiente: number;
  totalPagado: number;
  saldoFavor: number;
  facturasPendientes: FacturaPendienteDto[];
  ultimaActualizacion: Date;
}

export class FacturaPendienteDto {
  id: string;
  numero: string;
  tipo: string;
  periodo: string;
  monto: number;
  fechaEmision: Date;
  fechaVencimiento: Date;
  estado: string;
  siigoFacturaId?: string;
}