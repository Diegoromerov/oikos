import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './dto/user.dto';
import { UserRole, UserUnitRelationshipType } from './user.entity';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@core/tenancy/tenant-context.service';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    // tenantId comes from request.tenantContext
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findAll(
    @Query('activo') activo?: boolean,
    @Query('role') role?: UserRole,
  ) {
    return this.usersService.findByTenant('current-tenant-id');
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.JUNTA, UserRole.REVISOR_FISCAL)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/roles')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(id, assignRoleDto.role_id, 'current-tenant-id');
  }

  @Delete(':id/roles/:roleId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.usersService.removeRole(id, roleId);
  }

  @Post(':id/unidades')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async addUnitRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      unidad_id: string;
      tipo_relacion: UserUnitRelationshipType;
      es_principal?: boolean;
    },
  ) {
    return this.usersService.addUnitRelationship(
      id,
      body.unidad_id,
      body.tipo_relacion,
      body.es_principal,
    );
  }

  @Delete(':id/unidades/:unidadId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async removeUnitRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
  ) {
    return this.usersService.removeUnitRelationship(id, unidadId);
  }

  @Get(':id/unidades')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.PROPIETARIO, UserRole.RESIDENTE)
  async getUserUnits(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserUnits(id);
  }
}