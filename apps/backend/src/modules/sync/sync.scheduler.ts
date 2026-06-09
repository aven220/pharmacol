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

  private async enqueue(fuenteCodigo: string) {
    const job = await this.queue.add(
      'cron-sync',
      { fuenteCodigo },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );
    this.logger.log(`Sync programada encolada: ${fuenteCodigo} (job ${job.id})`);
  }
}
