import {
  QueueChannelOptions,
  QueueConnectOptions,
  QueueConsumeOptions,
  QueueOptions,
  QueuePublishOptions,
} from '../queue.options';
import { logLevel, RetryOptions } from 'kafkajs';

export enum ChannelType {
  Producer,
  Consumer,
}

export interface KafkaConnectOptions extends QueueConnectOptions {
  clientId: string;
  brokers: string[];
  retry?: RetryOptions;
  logLevel: logLevel;
  ssl: boolean;
  sasl: any;
}

export interface KafkaChannelOptions extends QueueChannelOptions {
  channelType: ChannelType;
  groupId: string;
}

export interface KafkaConsumeOptions
  extends KafkaChannelOptions,
    QueueConsumeOptions {
  topic: any;
  channelType: ChannelType;
}

export interface KafkaPublishOptions extends QueuePublishOptions {
  messageId?: string;
}

export interface KafkaOptions extends QueueOptions {
  connectOptions?: KafkaConnectOptions;

  consumeOptions?: KafkaConsumeOptions[];

  publishOptions?: KafkaChannelOptions[];
}
