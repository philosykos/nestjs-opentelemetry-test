import { Injectable, ModuleMetadata, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logLevel } from 'kafkajs';
import { PinoLogger } from 'nestjs-pino';
import {
  PUBLISH_EVENT_SUBSCRIPTION,
  PUBLISH_TRANSACTION_CALLBACK,
  PUBLISH_TRANSACTION_HISTORY,
  PUBLISH_TRANSACTION_SEND,
  SUBSCRIBE_TRANSACTION_SEND,
} from './queue.constants';
import { QueueOptions } from './queue.options';

export interface QueueAsyncOptions<T extends QueueOptions>
  extends Pick<ModuleMetadata, 'imports'> {
  // type: string;
  useFactory?: (...args: any[]) => T | Promise<T>;
  useClass?: Type<QueueOptionsFactory>;
  inject?: any[];
}

export interface QueueOptionsFactory {
  createQueueOptions();
}

@Injectable()
export class QueueConfigService implements QueueOptionsFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly log: PinoLogger,
  ) {}

  createQueueOptions() {
    const options = {
      connectOptions: {
        hostname: this.configService.get<string>('MQ_HOST'),
        port: Number(this.configService.get<number>('MQ_PORT')),
        username: this.configService.get<string>('MQ_USERNAME'),
        password: this.configService.get<string>('MQ_PASSWORD'),
        heartbeat: Number(this.configService.get<number>('MQ_HEARTBEAT', 5)),
        clientId: this.configService.get<string>('MQ_CLIENT_ID'),
        brokers: this.configService.get<string>('MQ_BROKERS')
          ? this.configService.get<string>('MQ_BROKERS').split(',')
          : [],
        logLevel: logLevel[this.configService.get<string>('MQ_LOG_LEVEL')],
        logCreator: (kafkalogLevel) => {
          return ({ namespace, level, label, log }) => {
            switch (level) {
              case logLevel.ERROR:
              case logLevel.NOTHING:
                return this.log.error(
                  'KAFKAJS: ' + namespace + log.message,
                  log,
                );
              case logLevel.WARN:
                return this.log.warn(
                  'KAFKAJS: ' + namespace + log.message,
                  log,
                );
              case logLevel.INFO:
                return this.log.info(
                  'KAFKAJS: ' + namespace + log.message,
                  log,
                );
              case logLevel.DEBUG:
                return this.log.debug(
                  'KAFKAJS: ' + namespace + log.message,
                  log,
                );
            }
          };
        },
        ssl: this.configService.get<string>('MQ_SSL') === 'true',
      },

      consumeOptions: [
        // Transaction
        {
          name: SUBSCRIBE_TRANSACTION_SEND,
          exchangeName: this.configService.get<string>(
            'MQ_TRANSACTION_SEND_EXCHANGE_NAME',
          ),
          exchangeType: this.configService.get<string>(
            'MQ_TRANSACTION_SEND_EXCHANGE_TYPE',
          ),
          queueName: this.configService.get<string>(
            'MQ_TRANSACTION_SEND_QUEUE_NAME',
          ),
          queueType: this.configService.get<string>('MQ_QUEUE_TYPE'),
          prefetch: Number(
            this.configService.get<string>(
              'MQ_TRANSACTION_SEND_QUEUE_PREFETCH',
              '1',
            ),
          ),
          routingKeys: this.configService
            .get<string>('MQ_TRANSACTION_SEND_ROUTING_KEYS')
            .split(','),
          autoCommit: false,
        },
      ],
      publishOptions: [
        // Transaction
        {
          name: PUBLISH_TRANSACTION_SEND,
          exchangeName: this.configService.get<string>(
            'MQ_TRANSACTION_SEND_EXCHANGE_NAME',
          ),
          exchangeType: this.configService.get<string>(
            'MQ_TRANSACTION_SEND_EXCHANGE_TYPE',
          ),
        },
        {
          name: PUBLISH_TRANSACTION_HISTORY,
          exchangeName: this.configService.get<string>(
            'MQ_TRANSACTION_HISTORY_RECORD_EXCHANGE_NAME',
          ),
          exchangeType: this.configService.get<string>(
            'MQ_TRANSACTION_HISTORY_RECORD_EXCHANGE_TYPE',
          ),
        },
        {
          name: PUBLISH_TRANSACTION_CALLBACK,
          exchangeName: this.configService.get<string>(
            'MQ_TRANSACTION_CALLBACK_EXCHANGE_NAME',
          ),
          exchangeType: this.configService.get<string>(
            'MQ_TRANSACTION_CALLBACK_EXCHANGE_TYPE',
          ),
        },
        // Event
        {
          name: PUBLISH_EVENT_SUBSCRIPTION,
          exchangeName: this.configService.get<string>(
            'MQ_EVENT_SUBSCRIPTION_EXCHANGE_NAME',
          ),
          exchangeType: this.configService.get<string>(
            'MQ_EVENT_SUBSCRIPTION_EXCHANGE_TYPE',
          ),
        },
      ],
    };

    switch (this.configService.get<string>('MQ_SASL_MECHANISM')) {
      case 'plain':
        options.connectOptions['sasl'] = {
          mechanism: this.configService.get<string>('MQ_SASL_MECHANISM'),
          username: this.configService.get<string>('MQ_USERNAME'),
          password: this.configService.get<string>('MQ_PASSWORD'),
        };
        break;
      case 'oauthbearer':
        options.connectOptions['sasl'] = {
          mechanism: this.configService.get<string>('MQ_SASL_MECHANISM'),
          oauthBearerProvider: async () => {
            return null;
          },
        };
        break;
      case 'aws':
        options.connectOptions['sasl'] = {
          mechanism: this.configService.get<string>('MQ_SASL_MECHANISM'),
          authorizationIdentity:
            this.configService.get<string>('MQ_SASL_AUTH_ID'), // UserId or RoleId
          accessKeyId: this.configService.get<string>('MQ_SASL_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>('MQ_SASL_ACCESS_KEY'),
          sessionToken: this.configService.get<string>('MQ_SASL_SESSION_TOKEN'), // Optional
        };
        break;
      default:
        break;
    }
    this.log.debug(`Queue Options >>> ${JSON.stringify(options)}`);
    return options;
  }
}
