import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';
import {
  QueueAsyncOptions,
  QueueOptionsFactory,
} from '../queue-config.service';
import { QUEUE_KAFKA_OPTION, QUEUE_SERVICE } from '../queue.constants';
import { KafkaClient } from './kafka.client';
import { KafkaOptions } from './kafka.options';
import { KafkaService } from './kafka.service';

export interface KafkaAsyncOptions
  extends Pick<ModuleMetadata, 'imports'>,
    QueueAsyncOptions<KafkaOptions> {}

@Module({})
export class KafkaModule {
  static forRootAsync(options?: KafkaAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    const imports: any[] = [...(options.imports || [])];
    const providers: any[] = [
      ...asyncProviders,
      KafkaClient,
      { provide: QUEUE_SERVICE, useClass: KafkaService },
    ];

    const exports: any[] = [{ provide: QUEUE_SERVICE, useClass: KafkaService }];

    return {
      global: true,
      module: KafkaModule,
      imports,
      providers,
      exports,
    };
  }

  private static createAsyncProviders(options: KafkaAsyncOptions): Provider[] {
    const useClass = options.useClass as Type<QueueOptionsFactory>;
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: KafkaAsyncOptions,
  ): Provider {
    const inject = [options.useClass as Type<QueueOptionsFactory>];
    return {
      provide: QUEUE_KAFKA_OPTION,
      useFactory: async (optionsFactory: QueueOptionsFactory) =>
        await optionsFactory.createQueueOptions(),
      inject,
    };
  }
}
