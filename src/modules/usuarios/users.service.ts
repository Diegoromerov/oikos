import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, Role, UserUnit, UserRole, UserUnitRelationshipType } from './user.entity';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserUnit)
    private readonly userUnitsRepository: Repository<UserUnit>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const password_hash = await bcrypt.hash(createUserDto.password, 10);

    // Extract password and roles from DTO
    const { password, roles: roleIds, unidades, ...userData } = createUserDto;

    // Create user
    const user = this.usersRepository.create({
      ...userData,
      password_hash,
      activo: createUserDto.activo ?? true,
    });

    // Assign roles if provided
    if (roleIds && roleIds.length > 0) {
      const roles = await this.rolesRepository.findBy({
        id: In(roleIds),
      });
      user.roles = roles;
    }

    // Save user first to get ID
    const savedUser = await this.usersRepository.save(user);

    // Create user-unit relationships if provided
    if (createUserDto.unidades && createUserDto.unidades.length > 0) {
      for (const unitDto of createUserDto.unidades) {
        const userUnit = this.userUnitsRepository.create({
          usuario_id: savedUser.id,
          ...unitDto,
        });
        await this.userUnitsRepository.save(userUnit);
      }
    }

    return this.findById(savedUser.id);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['roles', 'unidades'],
      order: { creado_en: 'DESC' },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'unidades'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roles', 'unidades'],
    });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    // Users with roles in a specific tenant
    const rolesInTenant = await this.rolesRepository.find({
      where: { tenant_id: tenantId },
    });
    const roleIds = rolesInTenant.map((r) => r.id);

    if (roleIds.length === 0) {
      return [];
    }

    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.unidades', 'userUnit')
      .where('role.id IN (:...roleIds)', { roleIds })
      .getMany();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // Check email uniqueness if being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }

    // Update roles if provided
    if (updateUserDto.roles) {
      const roles = await this.rolesRepository.findBy({
        id: In(updateUserDto.roles),
      });
      user.roles = roles;
    }

    // Remove roles from updateData to avoid overwriting (password not in DTO)
    const { roles: _roles, ...updateData } = updateUserDto;
    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
  }

  async assignRole(userId: string, roleId: string, tenantId: string): Promise<User> {
    const user = await this.findById(userId);
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if role belongs to the tenant or is global
    if (role.tenant_id && role.tenant_id !== tenantId && !role.es_global) {
      throw new BadRequestException('Role does not belong to this tenant');
    }

    // Check if already has this role
    if (!user.roles.some((r) => r.id === role.id)) {
      user.roles.push(role);
      await this.usersRepository.save(user);
    }

    return this.findById(userId);
  }

  async removeRole(userId: string, roleId: string): Promise<User> {
    const user = await this.findById(userId);
    user.roles = user.roles.filter((r) => r.id !== roleId);
    await this.usersRepository.save(user);
    return this.findById(userId);
  }

  async addUnitRelationship(
    userId: string,
    unidad_id: string,
    tipo_relacion: UserUnitRelationshipType,
    es_principal: boolean = false,
  ): Promise<UserUnit> {
    const user = await this.findById(userId);

    // If es_principal, unset other principal relationships for this unit
    if (es_principal) {
      await this.userUnitsRepository.update(
        { unidad_id, es_principal: true },
        { es_principal: false },
      );
    }

    const userUnit = this.userUnitsRepository.create({
      usuario_id: userId,
      unidad_id,
      tipo_relacion,
      es_principal,
    });

    return this.userUnitsRepository.save(userUnit);
  }

  async removeUnitRelationship(userId: string, unidad_id: string): Promise<void> {
    await this.userUnitsRepository.delete({ usuario_id: userId, unidad_id });
  }

  async getUserUnits(userId: string): Promise<UserUnit[]> {
    return this.userUnitsRepository.find({
      where: { usuario_id: userId },
      relations: ['unidad'],
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }
}