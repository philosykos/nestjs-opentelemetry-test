import { KafkaPublishOptions } from './kafka/kafka.options';
import { RabbitmqPublishOptions } from './rabbitmq/rabbitmq.options';

export enum MessageType {
  DIRECT = 'direct',
  DELAYED = 'x-delayed-message',
}

export interface QueueServiceInterface {
  publish(message: any, options?: KafkaPublishOptions | RabbitmqPublishOptions);
}
