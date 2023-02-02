import { DynamicModule, Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { QueueConfigService } from './queue-config.service';

@Module({})
export class QueueModule {
  static forRootAsync(mode): DynamicModule {
    if (mode === 'RABBITMQ') {
      return RabbitmqModule.forRootAsync({
        useClass: QueueConfigService,
      });
    } else {
      return KafkaModule.forRootAsync({
        useClass: QueueConfigService,
      });
    }

    return { module: QueueModule };
  }
}
