import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Context,
  Link,
  ROOT_CONTEXT,
  Span,
  SpanKind,
  Tracer,
  context,
  defaultTextMapGetter,
  propagation,
  trace,
} from '@opentelemetry/api';
import {
  MessagingDestinationKindValues,
  MessagingOperationValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { Options } from 'amqp-connection-manager';

@Injectable()
export class TraceService {
  private readonly mqType: string;
  private readonly tracer: Tracer;

  constructor(private readonly config: ConfigService) {
    this.tracer = trace.getTracer('chainz-trace-instrumentation');
    this.mqType = this.config.get<string>('MQ_TYPE');
  }

  public startProducerSpan(
    queue: string,
    publishOptions: Options.Publish,
  ): Span {
    const span = this.tracer.startSpan(queue, {
      kind: SpanKind.PRODUCER,
      attributes: {
        [SemanticAttributes.MESSAGING_SYSTEM]: this.mqType,
        [SemanticAttributes.MESSAGING_DESTINATION]: queue,
        [SemanticAttributes.MESSAGING_DESTINATION_KIND]:
          MessagingDestinationKindValues.TOPIC,
      },
    });
    publishOptions.headers = publishOptions.headers ?? {};
    propagation.inject(
      trace.setSpan(context.active(), span),
      publishOptions.headers,
    );

    return span;
  }

  public getProducerSpan(queue: string, message: any): Span {
    let _context: Context;
    if (message.headers) {
      _context = propagation.extract(
        ROOT_CONTEXT,
        message.headers,
        defaultTextMapGetter,
      );
    }
    const span = this.tracer.startSpan(
      queue,
      {
        kind: SpanKind.PRODUCER,
        attributes: {
          [SemanticAttributes.MESSAGING_SYSTEM]: this.mqType,
          [SemanticAttributes.MESSAGING_DESTINATION]: queue,
          [SemanticAttributes.MESSAGING_DESTINATION_KIND]:
            MessagingDestinationKindValues.TOPIC,
        },
      },
      _context,
    );

    if (!message.headers) {
      message.headers = message.headers ?? {};
      propagation.inject(
        trace.setSpan(context.active(), span),
        message.headers,
      );
    }

    return span;
  }

  public getConsumerSpan(topic: string, headers: any) {
    const propagatedContext: Context = propagation.extract(
      ROOT_CONTEXT,
      headers,
      defaultTextMapGetter,
    );
    // const spanContext = trace.getSpan(propagatedContext)?.spanContext();
    const _context = propagatedContext ? propagatedContext : ROOT_CONTEXT;
    // let originalSpanLink: Link;
    // if (spanContext) {
    //   originalSpanLink = {
    //     context: spanContext,
    //   };
    // }
    return this.startConsumerSpan(topic, _context);
  }

  private startConsumerSpan(
    topic: string,
    context: Context,
    link?: Link,
  ): Span {
    const span = this.tracer.startSpan(
      topic,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          [SemanticAttributes.MESSAGING_SYSTEM]: this.mqType,
          [SemanticAttributes.MESSAGING_DESTINATION]: topic,
          [SemanticAttributes.MESSAGING_DESTINATION_KIND]:
            MessagingDestinationKindValues.TOPIC,
          [SemanticAttributes.MESSAGING_OPERATION]:
            MessagingOperationValues.RECEIVE,
        },
        links: link ? [link] : [],
      },
      context,
    );
    return span;
  }

  public getCacheSpan(func: string, headers: any): Span {
    const propagatedContext: Context = propagation.extract(
      ROOT_CONTEXT,
      headers,
      defaultTextMapGetter,
    );

    const span = this.tracer.startSpan(
      `Redis ${func}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [SemanticAttributes.DB_SYSTEM]: 'redis',
          [SemanticAttributes.DB_STATEMENT]: func,
        },
      },
      propagatedContext,
    );
    return span;
  }

  public startCacheSpan(func: string, options: any, params: any): Span {
    const { host, port } = options;
    const span = this.tracer.startSpan(
      `Redis ${func}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [SemanticAttributes.DB_SYSTEM]: 'redis',
          [SemanticAttributes.DB_STATEMENT]: `${JSON.stringify(params)}`,
          [SemanticAttributes.NET_PEER_NAME]: host,
          [SemanticAttributes.NET_PEER_PORT]: port,
        },
      },
    );
    return span;
  }
}
