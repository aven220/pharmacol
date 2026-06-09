import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword, hashToken, verifyPassword } from '../../common/utils/crypto.util';
import {
  AuthTokens,
  AuthUserProfile,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('El email ya está registrado');

    const consultaRole = await this.prisma.role.findUnique({ where: { codigo: 'CONSULTA' } });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        nombre: dto.nombre,
        telefono: dto.telefono,
        status: UserStatus.PENDIENTE_VERIFICACION,
        roles: consultaRole
          ? { create: [{ roleId: consultaRole.id }] }
          : undefined,
      },
    });

    await this.audit.log({
      userId: user.id,
      accion: 'REGISTER',
      recurso: 'auth',
      ipAddress: ip,
    });

    return this.issueTokens(user.id, ip);
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status === UserStatus.BLOQUEADO) {
      if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
        throw new UnauthorizedException('Cuenta bloqueada temporalmente');
      }
    }

    if (!verifyPassword(dto.password, user.passwordHash)) {
      const intentos = user.intentosFallidos + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          intentosFallidos: intentos,
          bloqueadoHasta: intentos >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          status: intentos >= 5 ? UserStatus.BLOQUEADO : user.status,
        },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoLoginAt: new Date(),
        status: user.status === UserStatus.BLOQUEADO ? UserStatus.ACTIVO : user.status,
      },
    });

    await this.prisma.session.create({
      data: { userId: user.id, ipAddress: ip, userAgent, success: true },
    });

    await this.audit.log({
      userId: user.id,
      accion: 'LOGIN',
      recurso: 'auth',
      ipAddress: ip,
      userAgent,
    });

    return this.issueTokens(user.id, ip, dto.deviceFingerprint, userAgent);
  }

  async refresh(dto: RefreshTokenDto, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      stored.userId,
      ip,
      dto.deviceFingerprint ?? stored.deviceFingerprint ?? undefined,
      userAgent ?? stored.userAgent ?? undefined,
      stored.familyId,
    );
  }

  async logout(refreshToken: string, userId?: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (userId) {
      await this.audit.log({ userId, accion: 'LOGOUT', recurso: 'auth' });
    }
  }

  async getProfile(userId: string): Promise<AuthUserProfile> {
    const { payload } = await this.buildPayload(userId);
    return {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }

  private async issueTokens(
    userId: string,
    ip?: string,
    deviceFingerprint?: string,
    userAgent?: string,
    familyId?: string,
  ): Promise<AuthTokens> {
    const { payload } = await this.buildPayload(userId);
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshDays = 7;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = randomUUID() + randomUUID();
    const refreshFamilyId = familyId ?? randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        familyId: refreshFamilyId,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
        deviceFingerprint,
        ipAddress: ip,
        userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private async buildPayload(userId: string): Promise<{ payload: JwtPayload }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const roles = user.roles.map((ur) => ur.role.codigo);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.codigo),
        ),
      ),
    ];

    return {
      payload: {
        sub: user.id,
        email: user.email,
        nombre: user.nombre,
        roles,
        permissions,
      },
    };
  }
}
