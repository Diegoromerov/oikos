import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { ContabilidadPort } from './contabilidad.port';
import { MockAdapter } from './mock.adapter';

@Injectable()
export class ContabilidadAdapter implements ContabilidadPort, OnModuleInit {
  private readonly logger = new Logger(ContabilidadAdapter.name);
  private currentAdapter: ContabilidadPort;

  constructor(
    @Inject(MockAdapter)
    private readonly mockAdapter: MockAdapter,
    @InjectQueue('contabilidad-sync')
    private readonly syncQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    // Start with mock adapter
    this.currentAdapter = this.mockAdapter;
  }

  async onModuleInit(): Promise<void> {
    // Initialize sync worker
    this.initSyncWorker();
  }

  private initSyncWorker(): void {
    const worker = new Worker(
      'contabilidad-sync',
      async (job: Job) => {
        await this.processSyncJob(job);
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        concurrency: 2,
        limiter: {
          max: 10,
          duration: 60000,
        },
      },
    );

    worker.on('completed', (job) => {
      this.logger.log(`Sync job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Sync job ${job?.id} failed: ${err.message}`);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });
  }

  private async processSyncJob(job: Job): Promise<void> {
    const { type, payload } = job.data;
    
    switch (type) {
      case 'sync_factura':
        await this.currentAdapter.sincronizarFactura(payload.facturaId);
        break;
      case 'sync_pago':
        await this.currentAdapter.registrarPago(payload);
        break;
      case 'retry_pending':
        await this.retryPendingSyncs(payload.tenantId);
        break;
      default:
        this.logger.warn(`Unknown sync job type: ${type}`);
    }
  }

  // Public method to switch adapter when SIIGO is ready
  async switchToSiigoAdapter(siigoAdapter: ContabilidadPort): Promise<void> {
    this.logger.log('Switching from MockAdapter to SiigoAdapter');
    this.currentAdapter = siigoAdapter;
  }

  // Delegate all methods to current adapter
  async registrarPago(params: any): Promise<any> {
    return this.currentAdapter.registrarPago(params);
  }

  async obtenerEstadoCuenta(params: any): Promise<any> {
    return this.currentAdapter.obtenerEstadoCuenta(params);
  }

  async obtenerFacturasPendientes(params: any): Promise<any> {
    return this.currentAdapter.obtenerFacturasPendientes(params);
  }

  async sincronizarFactura(params: any): Promise<any> {
    return this.currentAdapter.sincronizarFactura(params);
  }

  async verificarEstadoSincronizacion(facturaId: string): Promise<any> {
    return this.currentAdapter.verificarEstadoSincronizacion(facturaId);
  }

  async healthCheck(): Promise<any> {
    return this.currentAdapter.verificarEstadoSincronizacion('health');
  }

  // Queue sync jobs
  async queueFacturaSync(facturaId: string, tenantId: string): Promise<void> {
    await this.syncQueue.add('sync_factura', { facturaId, tenantId }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  async queuePagoSync(pagoId: string, tenantId: string): Promise<void> {
    await this.syncQueue.add('sync_pago', { pagoId, tenantId }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  // Schedule periodic retry of pending syncs
  async scheduleRetryPendingSyncs(tenantId: string): Promise<void> {
    await this.syncQueue.add(
      'retry_pending',
      { tenantId },
      {
        repeat: { every: 5 * 60 * 1000 }, // Every 5 minutes
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }

  private async retryPendingSyncs(tenantId: string): Promise<void> {
    this.logger.log(`Retrying pending syncs for tenant ${tenantId}`);
    // This would query for pending invoices/payments and re-queue them
    // Implementation depends on repositories being injected
  }
}