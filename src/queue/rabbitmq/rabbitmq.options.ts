import {
  QueueChannelOptions,
  QueueConnectOptions,
  QueueConsumeOptions,
  QueueOptions,
  QueuePublishOptions,
} from '../queue.options';
import { Options } from 'amqp-connection-manager';

export enum QueueType {
  Quorum = 'quorum',
  Classic = 'classic',
}

export enum ExchangeType {
  DelayedMessage = 'x-delayed-message',
  DirectMessage = 'direct',
}

export interface RabbitmqConnectOptions
  extends QueueConnectOptions,
    Options.Connect {}

export interface RabbitmqChannelOptions extends QueueChannelOptions {
  exchangeName: string;

  exchangeType: ExchangeType;

  prefetch?: number;
}

export interface RabbitmqConsumeOptions
  extends RabbitmqChannelOptions,
    QueueConsumeOptions {
  queueName: string;
  routingKey: string;
  options?: Options.Consume;
  queueType: QueueType;
}

export interface RabbitmqPublishOptions extends QueuePublishOptions {
  exchangeName: string;

  options?: Options.Publish;
}

export interface RabbitmqOptions extends QueueOptions {
  connectOptions?: RabbitmqConnectOptions;

  consumeOptions?: RabbitmqConsumeOptions[];

  publishOptions?: RabbitmqChannelOptions[];
}
