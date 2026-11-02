export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    httpStatus = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class AdapterError extends Error {
  readonly code:
    | 'timeout'
    | 'disconnected'
    | 'unsupported'
    | 'rejected'
    | 'invalid_payload'
    | 'transport'
    | 'unhealthy';
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(
    code: AdapterError['code'],
    message: string,
    correlationId: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }
}
