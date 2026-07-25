'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return formatDate(d);
}

const FACTURA_STATUSES = ['pendiente', 'parcial', 'pagada', 'anulada', 'vencida'] as const;
const PAGO_STATUSES = ['confirmado', 'rechazado', 'devuelto'] as const;
const PQRS_STATUSES = ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado', 'reabierto'] as const;
const RESERVA_STATUSES = ['pendiente', 'confirmada', 'cancelada'] as const;
const COMUNICADO_STATUSES = ['informativo', 'urgente', 'evento', 'mantenimiento_programado'] as const;
const INCIDENTE_STATUSES = ['panico', 'emergencia_medica', 'incendio', 'seguridad', 'otro'] as const;

type FacturaStatus = typeof FACTURA_STATUSES[number];
type PagoStatus = typeof PAGO_STATUSES[number];
type PQRSStatus = typeof PQRS_STATUSES[number];
type ReservaStatus = typeof RESERVA_STATUSES[number];
type ComunicadoStatus = typeof COMUNICADO_STATUSES[number];
type IncidenteStatus = typeof INCIDENTE_STATUSES[number];

function isFacturaStatus(s: string): s is FacturaStatus {
  return FACTURA_STATUSES.includes(s as FacturaStatus);
}

function isPagoStatus(s: string): s is PagoStatus {
  return PAGO_STATUSES.includes(s as PagoStatus);
}

function isPQRSStatus(s: string): s is PQRSStatus {
  return PQRS_STATUSES.includes(s as PQRSStatus);
}

function isReservaStatus(s: string): s is ReservaStatus {
  return RESERVA_STATUSES.includes(s as ReservaStatus);
}

function isComunicadoStatus(s: string): s is ComunicadoStatus {
  return COMUNICADO_STATUSES.includes(s as ComunicadoStatus);
}

function isIncidenteStatus(s: string): s is IncidenteStatus {
  return INCIDENTE_STATUSES.includes(s as IncidenteStatus);
}

export function getStatusColor(status: string, context?: 'factura' | 'pago' | 'pqrs' | 'reserva' | 'comunicado' | 'incidente'): string {
  // Factura statuses
  if (context === 'factura' || isFacturaStatus(status)) {
    switch (status) {
      case 'pendiente': return 'text-yellow-400';
      case 'parcial': return 'text-blue-400';
      case 'pagada': return 'text-emerald-400';
      case 'anulada': return 'text-gray-500';
      case 'vencida': return 'text-red-400';
    }
  }

  // Pago statuses
  if (context === 'pago' || isPagoStatus(status)) {
    switch (status) {
      case 'confirmado': return 'text-emerald-400';
      case 'rechazado': return 'text-red-400';
      case 'devuelto': return 'text-orange-400';
    }
  }

  // PQRS statuses
  if (context === 'pqrs' || isPQRSStatus(status)) {
    switch (status) {
      case 'abierto': return 'text-blue-400';
      case 'en_proceso': return 'text-yellow-400';
      case 'resuelto': return 'text-emerald-400';
      case 'cerrado': return 'text-gray-500';
      case 'rechazado': return 'text-red-400';
      case 'reabierto': return 'text-purple-400';
    }
  }

  // Reserva statuses
  if (context === 'reserva' || isReservaStatus(status)) {
    switch (status) {
      case 'pendiente': return 'text-yellow-400';
      case 'confirmada': return 'text-emerald-400';
      case 'cancelada': return 'text-gray-500';
    }
  }

  // Comunicado statuses
  if (context === 'comunicado' || isComunicadoStatus(status)) {
    switch (status) {
      case 'informativo': return 'text-blue-400';
      case 'urgente': return 'text-red-400';
      case 'evento': return 'text-purple-400';
      case 'mantenimiento_programado': return 'text-orange-400';
    }
  }

  // Incidente statuses
  if (context === 'incidente' || isIncidenteStatus(status)) {
    switch (status) {
      case 'panico': return 'text-red-500';
      case 'emergencia_medica': return 'text-red-400';
      case 'incendio': return 'text-orange-500';
      case 'seguridad': return 'text-orange-400';
      case 'otro': return 'text-gray-400';
    }
  }

  // Fallback without context
  const fallbackColors: Record<string, string> = {
    pendiente: 'text-yellow-400',
    parcial: 'text-blue-400',
    pagada: 'text-emerald-400',
    anulada: 'text-gray-500',
    vencida: 'text-red-400',
    confirmado: 'text-emerald-400',
    rechazado: 'text-red-400',
    devuelto: 'text-orange-400',
    abierto: 'text-blue-400',
    en_proceso: 'text-yellow-400',
    resuelto: 'text-emerald-400',
    cerrado: 'text-gray-500',
    reabierto: 'text-purple-400',
    confirmada: 'text-emerald-400',
    cancelada: 'text-gray-500',
    informativo: 'text-blue-400',
    urgente: 'text-red-400',
    evento: 'text-purple-400',
    mantenimiento_programado: 'text-orange-400',
    panico: 'text-red-500',
    emergencia_medica: 'text-red-400',
    incendio: 'text-orange-500',
    seguridad: 'text-orange-400',
  };

  return fallbackColors[status] || 'text-gray-400';
}

export function getStatusBadge(status: string, context?: 'factura' | 'pago' | 'pqrs' | 'reserva' | 'comunicado' | 'incidente'): string {
  // Success badge for positive/resolved statuses
  const successStatuses = ['pagada', 'confirmado', 'resuelto', 'confirmada'];
  if (successStatuses.includes(status)) {
    return 'badge-success';
  }

  // Pill badge for pending/in-progress/negative statuses
  const pillStatuses = [
    'pendiente', 'parcial', 'anulada', 'vencida',
    'rechazado', 'devuelto',
    'abierto', 'en_proceso', 'cerrado', 'rechazado', 'reabierto',
    'pendiente', 'cancelada',
    'informativo', 'urgente', 'evento', 'mantenimiento_programado',
  ];
  if (pillStatuses.includes(status)) {
    return 'badge-pill';
  }

  return 'badge-pill';
}

export function isSLAOverdue(slaFechaLimite: string): boolean {
  return new Date(slaFechaLimite) < new Date();
}

export function getSLAStatus(slaFechaLimite: string, estado: string): 'ok' | 'warning' | 'overdue' {
  if (['resuelto', 'cerrado', 'rechazado'].includes(estado)) return 'ok';
  if (isSLAOverdue(slaFechaLimite)) return 'overdue';
  const now = new Date();
  const limit = new Date(slaFechaLimite);
  const diffHours = (limit.getTime() - now.getTime()) / 3600000;
  if (diffHours <= 24) return 'warning';
  return 'ok';
}

export function getPQRSStatusDisplay(estado: string, slaFechaLimite: string): { label: string; color: string; badge: string } {
  const isOverdue = isSLAOverdue(slaFechaLimite) && !['resuelto', 'cerrado', 'rechazado'].includes(estado);
  const baseColor = getStatusColor(estado, 'pqrs');
  const badge = getStatusBadge(estado, 'pqrs');

  if (isOverdue) {
    return {
      label: `${estado} (VENCIDO)`,
      color: 'text-red-400',
      badge,
    };
  }

  return { label: estado, color: baseColor, badge };
}

export function formatCoeficiente(value: number): string {
  return (value * 100).toFixed(4) + '%';
}

export function validateCoeficientesSum(unidades: Array<{ coeficiente_copropiedad: number }>): { sum: number; isValid: boolean; diff: number } {
  const sum = unidades.reduce((acc, u) => acc + (u.coeficiente_copropiedad || 0), 0);
  return {
    sum,
    isValid: Math.abs(sum - 1) < 0.0001,
    diff: sum - 1,
  };
}