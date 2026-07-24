import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Unidad, UnidadTipo } from './unidad.entity';
import { CreateUnidadDto, UpdateUnidadDto, BulkUnidadDto, CoeficienteValidationResult } from './dto/unidad.dto';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class UnidadesService {
  private readonly logger = new Logger(UnidadesService.name);

  constructor(
    @InjectRepository(Unidad)
    private readonly unidadesRepository: Repository<Unidad>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectQueue('unidades-validation')
    private readonly validationQueue: Queue,
  ) {}

  async create(createUnidadDto: CreateUnidadDto, tenantId: string): Promise<Unidad> {
    // Check uniqueness within tenant
    const whereCondition: any = {
      tenant_id: tenantId,
      torre: createUnidadDto.torre,
      numero: createUnidadDto.numero,
    };
    // Only add bloque to where condition if it has a value
    if (createUnidadDto.bloque !== undefined && createUnidadDto.bloque !== null && createUnidadDto.bloque !== '') {
      whereCondition.bloque = createUnidadDto.bloque;
    }

    const existing = await this.unidadesRepository.findOne({
      where: whereCondition,
    });

    if (existing) {
      throw new ConflictException(
        `Unit already exists: ${createUnidadDto.torre}${createUnidadDto.bloque ? '-' + createUnidadDto.bloque : ''}-${createUnidadDto.numero}`,
      );
    }

    const unidad = this.unidadesRepository.create({
      ...createUnidadDto,
      tenant_id: tenantId,
    });

    const saved = await this.unidadesRepository.save(unidad);
    await this.updateTenantStats(tenantId);
    await this.queueCoefficientValidation(tenantId);

    return saved;
  }

  async bulkCreate(bulkDto: BulkUnidadDto, tenantId: string): Promise<Unidad[]> {
    const results: Unidad[] = [];
    const errors: string[] = [];

    for (const [index, unidadDto] of bulkDto.unidades.entries()) {
      try {
        const whereCondition: any = {
          tenant_id: tenantId,
          torre: unidadDto.torre,
          numero: unidadDto.numero,
        };
        // Only add bloque if it has a value
        if (unidadDto.bloque !== undefined && unidadDto.bloque !== null && unidadDto.bloque !== '') {
          whereCondition.bloque = unidadDto.bloque;
        }

        const existing = await this.unidadesRepository.findOne({
          where: whereCondition,
        });

        if (existing) {
          errors.push(`Row ${index + 1}: Unit ${unidadDto.torre}${unidadDto.bloque ? '-' + unidadDto.bloque : ''}-${unidadDto.numero} already exists`);
          continue;
        }

        const unidad = this.unidadesRepository.create({
          ...unidadDto,
          tenant_id: tenantId,
        });

        results.push(unidad);
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    if (results.length > 0) {
      await this.unidadesRepository.save(results);
      await this.updateTenantStats(tenantId);
      await this.queueCoefficientValidation(tenantId);
    }

    if (errors.length > 0) {
      this.logger.warn(`Bulk create completed with ${errors.length} errors: ${errors.join('; ')}`);
    }

    return results;
  }

  async findAll(tenantId: string, filters?: { activo?: boolean; tipo_unidad?: UnidadTipo }): Promise<Unidad[]> {
    const query = this.unidadesRepository.createQueryBuilder('unidad')
      .where('unidad.tenant_id = :tenantId', { tenantId });

    if (filters?.activo !== undefined) {
      query.andWhere('unidad.activo = :activo', { activo: filters.activo });
    }

    if (filters?.tipo_unidad) {
      query.andWhere('unidad.tipo_unidad = :tipo', { tipo: filters.tipo_unidad });
    }

    return query.orderBy('unidad.torre').addOrderBy('unidad.bloque').addOrderBy('unidad.numero').getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Unidad> {
    const unidad = await this.unidadesRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['usuarios', 'usuarios.usuario'],
    });

    if (!unidad) {
      throw new NotFoundException('Unit not found');
    }

    return unidad;
  }

  async update(id: string, tenantId: string, updateUnidadDto: UpdateUnidadDto): Promise<Unidad> {
    const unidad = await this.findOne(id, tenantId);

    // Check uniqueness if torre/bloque/numero are being updated
    if (updateUnidadDto.torre || updateUnidadDto.bloque !== undefined || updateUnidadDto.numero) {
      const torre = updateUnidadDto.torre || unidad.torre;
      const bloque = updateUnidadDto.bloque !== undefined ? updateUnidadDto.bloque : unidad.bloque;
      const numero = updateUnidadDto.numero || unidad.numero;

      const whereCondition: any = {
        tenant_id: tenantId,
        torre,
        numero,
      };
      if (bloque !== undefined) {
        whereCondition.bloque = bloque;
      }

      const existing = await this.unidadesRepository.findOne({
        where: whereCondition,
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`Unit ${torre}${bloque ? '-' + bloque : ''}-${numero} already exists`);
      }
    }

    Object.assign(unidad, updateUnidadDto);
    const saved = await this.unidadesRepository.save(unidad);

    // If coefficient changed, update tenant stats and re-validate
    if (updateUnidadDto.coeficiente_copropiedad !== undefined) {
      await this.updateTenantStats(tenantId);
      await this.queueCoefficientValidation(tenantId);
    }

    return saved;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const unidad = await this.findOne(id, tenantId);
    await this.unidadesRepository.remove(unidad);
    await this.updateTenantStats(tenantId);
    await this.queueCoefficientValidation(tenantId);
  }

  async validateCoefficients(tenantId: string): Promise<CoeficienteValidationResult> {
    const result = await this.unidadesRepository
      .createQueryBuilder('unidad')
      .select('SUM(unidad.coeficiente_copropiedad)', 'total')
      .where('unidad.tenant_id = :tenantId', { tenantId })
      .andWhere('unidad.activo = true')
      .getRawOne();

    const total = parseFloat(result.total) || 0;
    const expected = 100;
    const difference = Math.abs(total - expected);
    const isValid = difference < 0.01; // Allow small floating point differences

    const validationResult: CoeficienteValidationResult = {
      total,
      expected,
      isValid,
      difference,
    };

    if (!isValid) {
      validationResult.warning = `ALERT: Coeficientes sum to ${total.toFixed(8)}%, expected 100%. Difference: ${difference.toFixed(8)}%. This violates PH regulation (Ley 675 de 2001).`;
      this.logger.warn(validationResult.warning);
    } else {
      this.logger.log(`Coefficients validation passed for tenant ${tenantId}: ${total}%`);
    }

    return validationResult;
  }

  async getCoefficientReport(tenantId: string): Promise<{
    total: number;
    byTipo: Record<string, number>;
    units: Unidad[];
  }> {
    const units = await this.findAll(tenantId, { activo: true });
    const total = units.reduce((sum, u) => sum + Number(u.coeficiente_copropiedad), 0);

    const byTipo: Record<string, number> = {};
    for (const unit of units) {
      byTipo[unit.tipo_unidad] = (byTipo[unit.tipo_unidad] || 0) + Number(unit.coeficiente_copropiedad);
    }

    return { total, byTipo, units };
  }

  private async updateTenantStats(tenantId: string): Promise<void> {
    const stats = await this.unidadesRepository
      .createQueryBuilder('unidad')
      .select([
        'COUNT(*) as total_unidades',
        'SUM(unidad.coeficiente_copropiedad) as coeficiente_total',
      ])
      .where('unidad.tenant_id = :tenantId', { tenantId })
      .andWhere('unidad.activo = true')
      .getRawOne();

    await this.tenantsRepository.update(tenantId, {
      totalUnidades: parseInt(stats.total_unidades) || 0,
      coeficienteTotal: parseFloat(stats.coeficiente_total) || 0,
    });
  }

  private async queueCoefficientValidation(tenantId: string): Promise<void> {
    await this.validationQueue.add('validate-coefficients', { tenantId }, {
      delay: 1000, // Small delay to allow transaction to commit
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async processCoefficientValidation(tenantId: string): Promise<CoeficienteValidationResult> {
    const result = await this.validateCoefficients(tenantId);
    
    // In a real system, this would send an alert/notification to admins
    if (!result.isValid) {
      this.logger.error(`COEFFICIENT VALIDATION FAILED for tenant ${tenantId}: ${result.warning}`);
      // TODO: Send notification to tenant admins via email/push
    }

    return result;
  }
}