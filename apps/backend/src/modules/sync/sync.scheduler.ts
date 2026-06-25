import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { SYNC_QUEUE, SyncJobData } from './sync.processor';

@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJobData>,
  ) {}

  @Cron(process.env.SYNC_CRON_CUM ?? '0 3 * * *')
  async scheduleCumSync() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    await this.enqueue('INVIMA_CUM_VIGENTES');
  }

  @Cron(process.env.SYNC_CRON_DM ?? '0 4 * * *')
  async scheduleDispositivosSync() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    await this.enqueue('INVIMA_DISPOSITIVOS');
  }

  @Cron(process.env.SYNC_CRON_ALERTAS ?? '0 5 * * *')
  async scheduleAlertasSync() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    await this.enqueue('INVIMA_ALERTAS_SANITARIAS');
  }

  @Cron(process.env.SYNC_CRON_ALERTAS_PORTAL ?? '0 7,11,15,19 * * *')
  async scheduleAlertasPortalSync() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    await this.enqueue('INVIMA_ALERTAS_PORTAL');
  }

  private async enqueue(fuenteCodigo: string) {
    const job = await this.queue.add(
      'cron-sync',
      { fuenteCodigo },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );
    this.logger.log(`Sync programada encolada: ${fuenteCodigo} (job ${job.id})`);
  }
}
