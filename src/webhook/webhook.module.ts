import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookProjectService } from './webhook.project.service';
import { ProjectService } from '../project/project.service';
import { TeamModule } from '../team/team.module';
@Module({
  imports: [TeamModule],
  providers: [ProjectService, WebhookService, WebhookProjectService],
  controllers: [WebhookController],
})
export class WebhookModule {}
