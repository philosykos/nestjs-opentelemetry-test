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
import { QUEUE_RABBITMQ_OPTION, QUEUE_SERVICE } from '../queue.constants';
import { RabbitmqClient } from './rabbitmq.client';
import { RabbitmqOptions } from './rabbitmq.options';
import { RabbitmqService } from './rabbitmq.service';

export interface RabbitmqAsyncOptions
  extends Pick<ModuleMetadata, 'imports'>,
    QueueAsyncOptions<RabbitmqOptions> {}

@Module({})
export class RabbitmqModule {
  static forRootAsync(options?: RabbitmqAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    const imports: any[] = [...(options.imports || [])];
    const providers: any[] = [
      ...asyncProviders,
      RabbitmqClient,
      { provide: QUEUE_SERVICE, useClass: RabbitmqService },
    ];

    const exports: any[] = [
      { provide: QUEUE_SERVICE, useClass: RabbitmqService },
    ];

    return {
      global: true,
      module: RabbitmqModule,
      imports,
      providers,
      exports,
    };
  }

  private static createAsyncProviders(
    options: RabbitmqAsyncOptions,
  ): Provider[] {
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
    options: RabbitmqAsyncOptions,
  ): Provider {
    const inject = [options.useClass as Type<QueueOptionsFactory>];
    return {
      provide: QUEUE_RABBITMQ_OPTION,
      useFactory: async (optionsFactory: QueueOptionsFactory) =>
        await optionsFactory.createQueueOptions(),
      inject,
    };
  }
}
