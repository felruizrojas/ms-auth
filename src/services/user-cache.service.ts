import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import type { UserRegisteredPayload, UserUpdatedPayload } from './types';

const credRepo = () => AppDataSource.getRepository(Credential);

export const syncUserRegistered = async (data: UserRegisteredPayload): Promise<void> => {
  const existing = await credRepo().findOne({ where: { id: data.userId } });
  if (existing) {
    console.log(`[user-cache] Credencial ${data.userId} ya existe, evento idempotente ignorado`);
    return;
  }

  // TypeORM respeta el id provisto aunque sea @PrimaryGeneratedColumn
  const cred = credRepo().create({
    email: data.email.toLowerCase(),
    password_hash: data.passwordHash,
    role: data.role,
    permissions: data.permissions,
    status: 'active',
    is_active: true,
    cached_data: {
      name: data.name,
      avatarUrl: data.avatarUrl,
      lastUpdated: new Date(),
    },
  });
  cred.id = data.userId;
  await credRepo().save(cred);

  console.log(`[user-cache] Credencial creada para userId=${data.userId} (${data.email})`);
};

export const syncUserUpdated = async (data: UserUpdatedPayload): Promise<void> => {
  const cred = await credRepo().findOne({ where: { id: data.userId } });
  if (!cred) {
    console.warn(`[user-cache] Credencial ${data.userId} no encontrada para actualizar`);
    return;
  }

  const update: Partial<Credential> = {};
  if (data.email !== undefined) update.email = data.email.toLowerCase();
  if (data.role !== undefined) update.role = data.role;
  if (data.permissions !== undefined) update.permissions = data.permissions;
  if (data.status !== undefined) {
    update.status = data.status;
    update.is_active = data.status === 'active';
  }

  // Merge incremental del cached_data sin pisar campos no enviados
  const currentCached = cred.cached_data ?? { name: '', lastUpdated: new Date() };
  let cachedChanged = false;
  if (data.name !== undefined) { currentCached.name = data.name; cachedChanged = true; }
  if (data.avatarUrl !== undefined) { currentCached.avatarUrl = data.avatarUrl; cachedChanged = true; }
  if (cachedChanged) { currentCached.lastUpdated = new Date(); update.cached_data = currentCached; }

  await credRepo().update({ id: data.userId }, update);
  console.log(`[user-cache] Credencial actualizada para userId=${data.userId}`);
};

export const syncUserDeleted = async (userId: string): Promise<void> => {
  await credRepo().update({ id: userId }, { status: 'inactive', is_active: false });
  console.log(`[user-cache] Credencial desactivada para userId=${userId}`);
};
