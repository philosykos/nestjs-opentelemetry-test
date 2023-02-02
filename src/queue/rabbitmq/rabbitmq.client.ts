import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RabbitmqClient implements OnModuleInit, OnApplicationShutdown {
  private readonly uri: string;
  private readonly protocol: string;
  private amqpConn: AmqpConnectionManager;
  private readonly channels: any;

  constructor(
    private readonly config: ConfigService,
    private readonly log: PinoLogger,
  ) {
    const hosts = this.config.get('MQ_HOST').split('://');
    this.protocol = hosts.length == 2 ? hosts[0] : 'amqp';
    const account = this.config.get('MQ_USERNAME')
      ? `${this.config.get('MQ_USERNAME')}:${this.config.get('MQ_PASSWORD')}@`
      : '';
    const host = hosts.length == 2 ? hosts[1] : '127.0.0.1';
    this.uri = encodeURI(
      `${this.protocol}://${account}${host}:${this.config.get('MQ_PORT')}`,
    );
    this.channels = {};
  }

  async onModuleInit() {
    this.log.debug('RabbitmqClient onModuleInit');
    try {
      await this.initConnection(this);
    } catch (err) {
      this.log.error(err);
    }
  }

  private initConnection(_this) {
    this.log.debug(`RabbitmqClient initConnection >>> ${this.uri}`);
    this.amqpConn = amqp.connect([this.uri]);
    this.amqpConn.on('disconnect', (err) => {
      _this.log.error('Rabbit MQ disconnected');
    });
    this.amqpConn.on('connect', (arg) => {
      _this.log.info('Rabbit MQ connected');
      _this.log.debug(`Connected URL >>> ${_this.uri}`);
    });
  }

  getChannel(name: string): ChannelWrapper {
    return this.channels[name];
  }

  addChannel(name: string, channelOptions: any) {
    const channel = this.getConnectionManager().createChannel(channelOptions);
    this.channels[name] = channel;
    return channel;
  }

  getConnectionManager(): AmqpConnectionManager {
    return this.amqpConn;
  }

  onApplicationShutdown(_signal?: string): any {
    this.log.debug('RabbitmqClient onApplicationShutdown');
    const channels = this.channels;
    Object.keys(this.channels).forEach(function (channel) {
      channels[channel].close();
    });

    this.amqpConn.close().catch((err) => {
      this.log.error(err);
    });
  }
}
