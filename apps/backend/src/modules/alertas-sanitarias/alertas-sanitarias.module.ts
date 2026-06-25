import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SyncModule } from '../sync/sync.module';
import { AlertasSanitariasController } from './alertas-sanitarias.controller';
import { AlertasSanitariasService } from './alertas-sanitarias.service';

@Module({
  imports: [SyncModule, AuditModule],
  controllers: [AlertasSanitariasController],
  providers: [AlertasSanitariasService],
  exports: [AlertasSanitariasService],
})
export class AlertasSanitariasModule {}
