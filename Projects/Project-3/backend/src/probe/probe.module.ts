import { Module } from '@nestjs/common';
import { ProbeController } from './probe.controller.js';
import { ProbeService } from './probe.service.js';

@Module({
  controllers: [ProbeController],
  providers: [ProbeService],
})
export class ProbeModule {}
