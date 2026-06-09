import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncService } from './sync.service';

export const SYNC_QUEUE = 'invima-sync';

export interface SyncJobData {
  fuenteCodigo: string;
  userId?: string;
}

@Processor(SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<unknown> {
    this.logger.log(`Procesando sync job ${job.id}: ${job.data.fuenteCodigo}`);
    return this.syncService.executeManual(job.data.fuenteCodigo, job.data.userId);
  }
}
