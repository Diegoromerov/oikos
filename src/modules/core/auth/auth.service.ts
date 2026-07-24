import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, Role } from '@modules/usuarios/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ access_token: string }> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['roles'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Get user roles with tenant info
    const userRoles = await this.getUserRolesWithTenant(user.id);

    const isSuperadmin = user.roles.some(r => r.tipo === 'superadmin' || r.es_global);

    const payload = {
      sub: user.id,
      email: user.email,
      roles: userRoles,
      is_superadmin: isSuperadmin,
    };

    const access_token = this.jwtService.sign(payload);

    return { access_token };
  }

  private async getUserRolesWithTenant(userId: string): Promise<Array<{ role_id: string; nombre: string; tipo: string; tenant_id: string | null; es_global: boolean }>> {
    // Get user roles with tenant info
    const query = `
      SELECT r.id as role_id, r.nombre, r.tipo, r.tenant_id, r.es_global
      FROM usuario_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.usuario_id = $1
    `;
    const result = await this.userRepo.query(query, [userId]);
    return result;
  }

  async validateUser(payload: any): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['roles'],
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}