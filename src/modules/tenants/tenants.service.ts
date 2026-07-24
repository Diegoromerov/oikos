import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantType, SiigoConfig } from './tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantsRepository.create(createTenantDto);
    return this.tenantsRepository.save(tenant);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.find();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { slug } });
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    Object.assign(tenant, updateTenantDto);
    return this.tenantsRepository.save(tenant);
  }

  async updateSiigoConfig(id: string, config: SiigoConfig): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.setSiigoConfig(config);
    return this.tenantsRepository.save(tenant);
  }

  async getDecryptedSiigoConfig(id: string): Promise<SiigoConfig | null> {
    const tenant = await this.findOne(id);
    return tenant.getSiigoConfig();
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantsRepository.remove(tenant);
  }

  async updateCoeficienteTotal(id: string, coeficiente: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.coeficienteTotal = coeficiente;
    return this.tenantsRepository.save(tenant);
  }

  async updateTotalUnidades(id: string, total: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.totalUnidades = total;
    return this.tenantsRepository.save(tenant);
  }
}