import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Partitioners } from 'kafkajs';
import { PinoLogger } from 'nestjs-pino';
import { QUEUE_KAFKA_OPTION } from '../queue.constants';
import {
  ChannelType,
  KafkaChannelOptions,
  KafkaOptions,
} from './kafka.options';

@Injectable()
export class KafkaClient implements OnModuleInit, OnApplicationShutdown {
  private kafka: Kafka;
  private readonly publishChannels: any;
  private readonly subscribeChannels: any;

  constructor(
    private readonly config: ConfigService,
    private readonly log: PinoLogger,
    @Inject(QUEUE_KAFKA_OPTION)
    protected readonly kafkaOptions: KafkaOptions,
  ) {
    this.publishChannels = {};
    this.subscribeChannels = {};
  }

  async onModuleInit() {
    this.log.info('KafkaClient onModuleInit');
    try {
      this.kafka = this.initConnection();
    } catch (err) {
      this.log.error(err);
    }
  }

  private initConnection() {
    this.log.info(
      `KafkaClient initConnection >>> ${JSON.stringify(
        this.kafkaOptions.connectOptions,
      )}`,
    );
    return new Kafka(this.kafkaOptions.connectOptions);
  }

  getChannel(name: string, channelType: ChannelType) {
    let channel;
    switch (channelType) {
      case ChannelType.Consumer:
        channel = this.subscribeChannels[name];
        break;
      case ChannelType.Producer:
        channel = this.publishChannels[name];
        break;
      default:
        break;
    }
    return channel;
  }

  addChannel(options: KafkaChannelOptions) {
    let channel;
    switch (options.channelType) {
      case ChannelType.Producer:
        channel = this.kafka.producer({
          createPartitioner: Partitioners.LegacyPartitioner,
        });
        this.publishChannels[options.name] = {
          exchangeName: options.exchangeName,
          channel: channel,
        };
        break;
      case ChannelType.Consumer:
        channel = this.kafka.consumer({
          groupId: options.groupId,
        });
        this.subscribeChannels[options.name] = {
          exchangeName: options.exchangeName,
          channel: channel,
        };
        break;
      default:
        break;
    }

    return channel;
  }

  onApplicationShutdown(_signal?: string): any {
    this.log.debug('RabbitmqClient onApplicationShutdown');
    const publishChannels = this.publishChannels;
    Object.keys(this.publishChannels).forEach(function (channel) {
      publishChannels[channel].disconnect();
    });

    const subscribeChannels = this.subscribeChannels;
    Object.keys(this.subscribeChannels).forEach(function (channel) {
      subscribeChannels[channel].disconnect();
    });
  }
}
