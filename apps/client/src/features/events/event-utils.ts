import type { ApiError, EventTicketStatus } from '../../lib/api-client';

export function formatEventDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatEventMoney(cents: number, currency: string): string {
  if (cents === 0) return 'Free';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function getEventError(error: unknown): string {
  return (error as ApiError).message ?? 'Something went wrong. Please try again.';
}

export function getTicketStatusLabel(status: EventTicketStatus): string {
  return status.replace('_', ' ');
}
