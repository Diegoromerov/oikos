import { PagoMetodo, PagoEstadoSync } from '../pago.entity';

export interface CreatePagoDto {
  factura_id: string;
  monto: number;
  metodo_pago: string; // String from request, will be converted to enum in service
  wompi_transaction_id?: string;
  wompi_reference?: string;
  wompi_payment_link_id?: string;
  fecha_pago?: Date;
  metadata?: Record<string, any>;
}

export interface WompiWebhookDto {
  event: 'transaction.created' | 'transaction.updated' | 'transaction.approved' | 'transaction.declined';
  data: {
    transaction: {
      id: string;
      amount_in_cents: number;
      reference: string;
      status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
      payment_link_id?: string;
      payment_method?: { type: string; installments?: number };
      customer_email: string;
      created_at: string;
      paid_at?: string;
    };
  };
  sent_at: string;
  timestamp: string;
}

export interface PagoResponseDto {
  id: string;
  unidad_id: string;
  factura_id?: string;
  monto: number;
  metodo_pago: string;
  wompi_transaction_id?: string;
  estado_sync: string;
  siigo_pago_id?: string;
  fecha_pago: Date;
  creado_en: Date;
}