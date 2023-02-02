// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueueConnectOptions {}

export interface QueueChannelOptions {
  name: string;
  exchangeName: string;
  routingKeys?: any;
  autoCommit?: boolean;
}

export interface QueueConsumeOptions {
  name: string;
}

export interface QueuePublishOptions {
  name: string;
  headers?: { 'x-delay'?: number };
  routingKey?: string;
}

export interface QueueOptions {
  uri?: string;

  connectOptions?: QueueConnectOptions;

  consumeOptions?: QueueConsumeOptions[];

  publishOptions?: QueuePublishOptions[];
}
