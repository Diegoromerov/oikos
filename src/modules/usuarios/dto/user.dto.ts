import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  MinLength,
  IsUUID,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserUnitRelationshipType } from '../user.entity';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  foto_url?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roles?: string[]; // Role IDs

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserUnitDto)
  unidades?: CreateUserUnitDto[];
}

export class CreateUserUnitDto {
  @IsUUID('4')
  unidad_id: string;

  @IsEnum(UserUnitRelationshipType)
  tipo_relacion: UserUnitRelationshipType;

  @IsOptional()
  @IsBoolean()
  es_principal?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apellido?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  foto_url?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roles?: string[];
}

export class AssignRoleDto {
  @IsUUID('4')
  role_id: string;
}

export class RemoveRoleDto {
  @IsUUID('4')
  role_id: string;
}