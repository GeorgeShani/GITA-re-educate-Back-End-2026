import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  StreamCheckpoint,
  StreamCheckpointDocument,
} from './stream-checkpoint.schema';

export const OUTBOX_STREAM_NAME = 'outbox';

@Injectable()
export class StreamCheckpointRepository {
  constructor(
    @InjectModel(StreamCheckpoint.name)
    private readonly checkpointModel: Model<StreamCheckpointDocument>,
  ) {}

  async getResumeToken(
    streamName: string,
  ): Promise<Record<string, unknown> | null> {
    const doc = await this.checkpointModel.findOne({ streamName }).exec();
    return doc?.resumeToken ?? null;
  }

  async saveResumeToken(
    streamName: string,
    resumeToken: Record<string, unknown>,
  ): Promise<void> {
    await this.checkpointModel
      .updateOne({ streamName }, { $set: { resumeToken } }, { upsert: true })
      .exec();
  }
}
