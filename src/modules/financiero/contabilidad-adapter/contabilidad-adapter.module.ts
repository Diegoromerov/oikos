import { Module } from '@nestjs/common';
import { ContabilidadPort } from './contabilidad.port';
import { MockAdapter } from './mock.adapter';
import { ContabilidadAdapter } from './contabilidad.adapter';

@Module({
  providers: [
    MockAdapter,
    ContabilidadAdapter,
    {
      provide: 'ContabilidadPort',
      useExisting: ContabilidadAdapter,
    },
  ],
  exports: [MockAdapter, ContabilidadAdapter, 'ContabilidadPort'],
})
export class ContabilidadAdapterModule {}