import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core modules
import { AuthModule } from './modules/core/auth/auth.module';
import { TenancyModule } from './modules/core/tenancy/tenancy.module';
import { EncryptionModule } from './modules/core/encryption/encryption.module';

// Feature modules
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/usuarios/users.module';
import { UnidadesModule } from './modules/unidades/unidades.module';
import { FinancieroModule } from './modules/financiero/financiero.module';
import { PorteriaModule } from './modules/porteria/porteria.module';
import { PqrsModule } from './modules/pqrs/pqrs.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { ComunicadosModule } from './modules/comunicados/comunicados.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'glowapp',
        password: process.env.DB_PASSWORD || 'glowapp_dev_2026',
        database: process.env.DB_NAME || 'glowapp',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),

    // Redis/BullMQ - connection and global queue registration
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: 'contabilidad-sync' }),

    // Schedule
    ScheduleModule.forRoot(),

    // Event Emitter (GLOBAL)
    EventEmitterModule.forRoot({ global: true }),

    // Core modules
    AuthModule,
    TenancyModule,
    EncryptionModule,

    // Feature modules
    TenantsModule,
    UsersModule,
    UnidadesModule,
    FinancieroModule,
    PorteriaModule,
    PqrsModule,
    ReservasModule,
    ComunicadosModule,
    DashboardModule,
  ],
})
export class AppModule {}
