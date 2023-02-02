import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelWrapper } from 'amqp-connection-manager';
import { PinoLogger } from 'nestjs-pino';
import { QueueServiceInterface } from '../queue-service.interface';
import { QUEUE_RABBITMQ_OPTION } from '../queue.constants';
import { RabbitmqClient } from './rabbitmq.client';
import {
  ExchangeType,
  RabbitmqChannelOptions,
  RabbitmqConsumeOptions,
  RabbitmqOptions,
  RabbitmqPublishOptions,
} from './rabbitmq.options';
import { ArrayUtils } from '../utils/array.utils';
import { CommonUtils } from '../utils/common.utils';

@Injectable()
export class RabbitmqService implements QueueServiceInterface, OnModuleInit {
  private readonly enableDelayedMessage;
  private readonly deliveryLimit;
  private readonly deliveryPeriod;

  constructor(
    private readonly log: PinoLogger,
    private readonly config: ConfigService,
    @Inject(QUEUE_RABBITMQ_OPTION)
    protected readonly rabbitmqOptions: RabbitmqOptions,
    private readonly rabbitmqClient: RabbitmqClient,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.enableDelayedMessage =
      this.config.get<string>('MQ_ENABLE_DELAYED_MESSAGE') === 'true';
    this.deliveryLimit = Number(
      this.config.get<string>('MQ_DELIVERY_LIMIT', '10'),
    );
    this.deliveryPeriod = Number(
      this.config.get<string>('MQ_DELIVERY_PERIOD', '1000'),
    );
  }

  async onModuleInit() {
    this.log.debug('RabbitmqService onModuleInit');
    try {
      if (ArrayUtils.hasElements(this.rabbitmqOptions.consumeOptions)) {
        for (const channelOption of this.rabbitmqOptions.consumeOptions) {
          await this.createChannel(channelOption);
          await this.subscribe(channelOption);
        }
      }

      if (ArrayUtils.hasElements(this.rabbitmqOptions.publishOptions)) {
        // eslint-disable-next-line no-restricted-syntax
        for (const channelOption of this.rabbitmqOptions.publishOptions) {
          // eslint-disable-next-line no-await-in-loop
          await this.createChannel(channelOption);
        }
      }
    } catch (err) {
      this.log.error(err);
    }
  }

  private createChannel(options: RabbitmqChannelOptions) {
    this.log.debug(`RabbitmqService createChannel >>> ${options.name}`);
    let params;
    if (
      this.enableDelayedMessage &&
      options.exchangeType == ExchangeType.DelayedMessage
    ) {
      params = { arguments: { 'x-delayed-type': 'direct' } };
    }

    return this.rabbitmqClient.addChannel(options.name, {
      json: true,
      setup: function (channel) {
        return Promise.all([
          channel.assertExchange(
            options.exchangeName,
            options.exchangeType.valueOf(),
            params,
          ),
        ]);
      },
    });
  }

  async publish(
    message: any,
    options: RabbitmqPublishOptions,
  ): Promise<boolean> {
    this.log.debug(`RabbitmqService publish >>> ${options.name}`);
    const exchangeOption = this.getExchangeOptionByName(options.name);
    const publishOptions = CommonUtils.isValid(options.options)
      ? { ...options.options, persistent: true }
      : { persistent: true };
    let isSuccess: boolean;
    return this.rabbitmqClient
      .getChannel(options.name)
      .publish(
        exchangeOption.exchangeName,
        options.routingKey,
        message,
        publishOptions,
      );
  }

  private getExchangeOptionByName(name: string) {
    for (const publishOption of this.rabbitmqOptions.publishOptions) {
      if (name === publishOption.name) return publishOption;
    }
  }

  private async subscribe(options: RabbitmqConsumeOptions) {
    this.log.info(`RabbitmqService subscribe >>> ${options.name}`);
    const channelWrapper: ChannelWrapper = this.rabbitmqClient.getChannel(
      options.name,
    );
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;
    return channelWrapper.addSetup(
      function (channel) {
        const queueOptions = {
          durable: true,
          arguments: {
            'x-queue-type': options.queueType,
          },
        };
        const values = [
          channel.assertQueue(options.queueName, queueOptions),
          channel.prefetch(options.prefetch),
          channel.consume(
            options.queueName,
            async function (consumeMessage) {
              const content = consumeMessage.content.toString();
              const { headers } = consumeMessage.properties;
              const message = JSON.parse(content);
              for (let index = 0; index < _this.deliveryLimit; index++) {
                try {
                  await _this.eventEmitter.emitAsync(
                    options.name,
                    message,
                    index,
                    headers,
                  );
                  break;
                } catch (err) {
                  _this.log.error(`NACK >>> ${options.name}`);
                  if (options.autoCommit) break;
                  await _this.sleep(_this.deliveryPeriod);
                }
              }
              if (!options.autoCommit) {
                _this.log.debug(`ACK >>> ${options.name}`);
                channel.ack(consumeMessage);
              }
            },
            { noAck: options.autoCommit },
          ),
        ];
        options.routingKeys.forEach((routingKey) => {
          values.push(
            channel.bindQueue(
              options.queueName,
              options.exchangeName,
              routingKey,
            ),
          );
        });
        return Promise.all(values);
      },
      (err) => {
        if (err) _this.log.error(err);
        else
          _this.log.info(`RabbitmqService subscribe ready >>> ${options.name}`);
      },
    );
  }

  private async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
