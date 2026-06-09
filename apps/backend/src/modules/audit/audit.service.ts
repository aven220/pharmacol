import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  userId?: string;
  accion: string;
  recurso?: string;
  recursoId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        accion: input.accion,
        recurso: input.recurso,
        recursoId: input.recursoId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
