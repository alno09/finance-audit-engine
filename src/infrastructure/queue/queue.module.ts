import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
    imports: [
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST ?? 'localhost',
                port: Number(process.env.REDIS_PORT ?? 6379),
            },
        }),
    ],
    exports: [BullModule]
})
export class QueueModule {}