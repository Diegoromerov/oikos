import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './tenant.entity';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async create(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  async findAll(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Tenant> {
    return this.tenantsService.findOne(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<Tenant> {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    return tenant;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenantsService.remove(id);
  }

  @Get(':id/siigo-config')
  async getSiigoConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.getDecryptedSiigoConfig(id);
  }

  @Patch(':id/siigo-config')
  async updateSiigoConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() config: any,
  ) {
    return this.tenantsService.updateSiigoConfig(id, config);
  }
}