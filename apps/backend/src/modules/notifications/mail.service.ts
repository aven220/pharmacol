import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

export interface AlertaDigestItem {
  numeroAlerta: string;
  titulo: string;
  fechaAlerta: Date;
  accion: 'INSERT' | 'UPDATE';
  documentoUrl?: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) return null;

    this.transporter = createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
    return this.transporter;
  }

  /** Usa el correo ya configurado en PharmaCol (misma cadena que scripts/sync-invima.sh). */
  private async resolveRecipients(): Promise<string[]> {
    const fromEnv = [
      this.config.get<string>('ALERTAS_DIGEST_EMAIL'),
      this.config.get<string>('PHARMACOL_EMAIL'),
      this.config.get<string>('SEED_ADMIN_EMAIL'),
    ]
      .flatMap((raw) => (raw ?? '').split(/[,;]/))
      .map((e) => e.trim())
      .filter(Boolean);

    if (fromEnv.length) return [...new Set(fromEnv)];

    const admins = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVO,
        deletedAt: null,
        roles: {
          some: {
            role: { codigo: { in: ['ADMINISTRADOR'] } },
          },
        },
      },
      select: { email: true },
    });

    return [...new Set(admins.map((u) => u.email))];
  }

  async sendAlertasDigest(items: AlertaDigestItem[], syncSummary?: string): Promise<boolean> {
    const recipients = await this.resolveRecipients();
    if (!recipients.length) {
      this.logger.warn(
        'Sin destinatario para digest — configure PHARMACOL_EMAIL o SEED_ADMIN_EMAIL en .env, o un usuario ADMINISTRADOR',
      );
      return false;
    }

    const today = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject =
      items.length > 0
        ? `[PharmaCol] ${items.length} alerta(s) sanitaria(s) INVIMA — ${today}`
        : `[PharmaCol] Sin nuevas alertas INVIMA — ${today}`;

    const rows = items
      .map((a) => {
        const fecha = a.fechaAlerta.toISOString().slice(0, 10);
        const link = a.documentoUrl
          ? `<br><a href="${a.documentoUrl}">Ver documento PDF</a>`
          : '';
        return `<li><strong>[${a.accion}] ${a.numeroAlerta}</strong> (${fecha}) — ${a.titulo}${link}</li>`;
      })
      .join('\n');

    const html = `
      <h2>Resumen diario — Alertas Sanitarias INVIMA</h2>
      <p>${today}</p>
      ${syncSummary ? `<p><em>${syncSummary}</em></p>` : ''}
      ${
        items.length
          ? `<p>Se detectaron <strong>${items.length}</strong> alerta(s) nueva(s) o actualizada(s):</p><ul>${rows}</ul>`
          : '<p>No hubo alertas nuevas ni actualizaciones en la última sincronización.</p>'
      }
      <hr>
      <p style="font-size:12px;color:#666">PharmaCol — sincronización automática desde datos.gov.co (INVIMA)</p>
    `;

    const transport = this.getTransporter();
    if (!transport) {
      this.logger.warn(
        `SMTP no configurado — digest registrado en logs para ${recipients.join(', ')}: ${items.length} alerta(s)`,
      );
      for (const item of items) {
        this.logger.log(`  [${item.accion}] ${item.numeroAlerta} — ${item.titulo.slice(0, 80)}`);
      }
      return false;
    }

    const from =
      this.config.get<string>('SMTP_FROM') ??
      `"PharmaCol Alertas" <${this.config.get<string>('SMTP_USER')}>`;

    await transport.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      html,
    });

    this.logger.log(`Digest enviado a ${recipients.join(', ')} (${items.length} alerta(s))`);
    return true;
  }
}
