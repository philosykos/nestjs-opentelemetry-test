import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { QueueServiceInterface } from '../queue-service.interface';
import { QUEUE_KAFKA_OPTION } from '../queue.constants';
import { KafkaClient } from './kafka.client';
import {
  ChannelType,
  KafkaChannelOptions,
  KafkaConsumeOptions,
  KafkaOptions,
  KafkaPublishOptions,
} from './kafka.options';
import { ArrayUtils } from '../utils/array.utils';

@Injectable()
export class KafkaService implements QueueServiceInterface, OnModuleInit {
  private readonly enableDelayedMessage;
  private readonly deliveryLimit;
  private readonly deliveryPeriod;

  constructor(
    private readonly log: PinoLogger,
    private readonly config: ConfigService,
    @Inject(QUEUE_KAFKA_OPTION)
    protected readonly kafkaOptions: KafkaOptions,
    private readonly kafkaClient: KafkaClient,
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
    this.log.info('KafkaService onModuleInit');
    try {
      if (ArrayUtils.hasElements(this.kafkaOptions.consumeOptions)) {
        for (const channelOption of this.kafkaOptions.consumeOptions) {
          for (const routingKey of channelOption.routingKeys) {
            channelOption.topic = {
              topic: `${channelOption.exchangeName}_${routingKey}`,
              fromBeginning: false,
            };
            channelOption.channelType = ChannelType.Consumer;
            channelOption.groupId = channelOption.name;
            await this.createChannel(channelOption);
            await this.subscribe(channelOption);
          }
        }
      }

      if (ArrayUtils.hasElements(this.kafkaOptions.publishOptions)) {
        for (const channelOption of this.kafkaOptions.publishOptions) {
          channelOption.channelType = ChannelType.Producer;
          await this.createChannel(channelOption);
        }
      }
    } catch (err) {
      this.log.error(err);
    }
  }

  async publish(message: any, options: KafkaPublishOptions) {
    const values = [];
    // for (const routingKey of options.routingKeys) {
    values.push(this.sendMessage(message, options.routingKey, options));
    // }
    return Promise.all(values);
  }

  private createChannel(options: KafkaChannelOptions) {
    this.log.debug(`KafkaService createChannel >>> ${JSON.stringify(options)}`);
    const channel = this.kafkaClient.addChannel(options);
    return channel.connect();
  }

  private async sendMessage(
    message: any,
    routingKey: string,
    options: KafkaPublishOptions,
  ) {
    const { exchangeName, channel } = this.kafkaClient.getChannel(
      options.name,
      ChannelType.Producer,
    );

    const record = {
      topic: `${exchangeName}_${routingKey}`,
      messages: [],
    };
    if (options.messageId) {
      record.messages.push({
        key: options.messageId,
        value: JSON.stringify(message),
      });
    } else {
      record.messages.push({
        value: JSON.stringify(message),
      });
    }
    if (options.headers && options.headers['x-delay']) {
      this.log.debug(
        `Delayed message >>> ${JSON.stringify(options.headers['x-delay'])}`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, options.headers['x-delay']),
      );
    }
    this.log.debug(`Publish message >>> ${JSON.stringify(record)}`);
    return channel.send(record);
  }

  private async subscribe(options: KafkaConsumeOptions) {
    this.log.debug(`KafkaService subscribe >>> ${JSON.stringify(options)}`);
    const eventEmitter = this.eventEmitter;
    const { exchangeName, channel } = this.kafkaClient.getChannel(
      options.name,
      ChannelType.Consumer,
    );
    // await channel.subscribe({ topic: options.topic, fromBeginning: true });
    await channel.subscribe(options.topic);
    await channel.run({
      // autoCommit: options.autoCommit,
      autoCommitThreshold: 1,
      eachMessage: async ({ topic, partition, message }) => {
        const content = message.value.toString();
        const jsonMessage = JSON.parse(content);
        for (let index = 0; index < this.deliveryLimit; index++) {
          try {
            await eventEmitter.emitAsync(options.name, jsonMessage, index);
            this.log.info(`ACK >>> ${options.name} - ${message.offset}`);
            break;
          } catch (err) {
            this.log.error(`NACK >>> ${options.name} - ${message.offset}`);
            if (options.autoCommit) break;
            await this.sleep(this.deliveryPeriod);
          }
        }
      },
    });
  }

  private async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
