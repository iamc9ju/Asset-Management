import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT, S3_CLIENT } from '../../shared/infrastructure/infrastructure.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  @Get()
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    const checks = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.connect().catch((error: unknown) => {
        if (this.redis.status !== 'ready') throw error;
      }).then(() => this.redis.ping()),
      this.s3.send(new ListBucketsCommand({})),
    ]);
    const names = ['postgres', 'redis', 'seaweedfs'];
    const services = Object.fromEntries(
      checks.map((result, index) => [names[index], result.status === 'fulfilled' ? 'up' : 'down']),
    );

    if (checks.some((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException({ status: 'degraded', services });
    }

    return { status: 'ok', services, timestamp: new Date().toISOString() };
  }
}

