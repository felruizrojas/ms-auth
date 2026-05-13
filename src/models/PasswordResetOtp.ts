import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('password_reset_otps')
export class PasswordResetOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  code!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ default: false })
  used!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
