import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface CachedUserData {
  name: string;
  avatarUrl?: string;
  tipo?: 'ciudadano' | 'institucion';
  lastUpdated: Date;
}

@Entity('credentials')
export class Credential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password_hash!: string;

  @Column({ default: 'ciudadano' })
  role!: string;

  // Array de permisos replicado desde ms-users vía eventos
  @Column({ type: 'simple-array', nullable: true, default: null })
  permissions!: string[] | null;

  // Datos de perfil cacheados para evitar consultas a ms-users
  @Column({ type: 'jsonb', nullable: true, default: null })
  cached_data!: CachedUserData | null;

  // Estado sincronizado desde ms-users. Fuente de verdad para bloqueos.
  @Column({ default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
