// Tipos de eventos que ms-users emite hacia ms-auth vía Bull/Redis.
// Deben mantenerse sincronizados con ms-users/src/events/event-emitter.service.ts

export interface UserRegisteredPayload {
  event: 'user.registered';
  userId: string;
  email: string;
  passwordHash: string;
  role: string;
  permissions: string[];
  name: string;
  avatarUrl?: string;
  timestamp: Date;
}

export interface UserUpdatedPayload {
  event: 'user.updated';
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
  name?: string;
  avatarUrl?: string;
  status?: 'active' | 'inactive';
  timestamp: Date;
}

export interface UserDeletedPayload {
  event: 'user.deleted';
  userId: string;
  timestamp: Date;
}
