import { Span, SpanKind, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { defaultDbStatementSerializer } from '@opentelemetry/redis-common';
import {
  SemanticAttributes
} from '@opentelemetry/semantic-conventions';
import Redis, { Cluster, Command, RedisOptions } from 'ioredis';
import shimmer from 'shimmer';

const DB_TYPE = 'redis';
export function patch(redis: Redis | Cluster, tracer: Tracer) {
  console.log(redis);
  shimmer.wrap(Redis.prototype, 'sendCommand', (obj) => traceSendCommand(obj));

  function traceSendCommand(original) {
    console.log(original);
    return function (commandObj) {
      const { name, args } = commandObj.command;
      // const statement = defaultDbStatementSerializer(
      //   name, args
      // );
      const span: Span = tracer.startSpan(`${DB_TYPE} ${name}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          [SemanticAttributes.DB_SYSTEM]: DB_TYPE,
          // [SemanticAttributes.DB_STATEMENT]: statement,
        }
      });
      let options: RedisOptions;
      if (redis instanceof Redis) {
        options = redis.options;
      } else {
        options = redis.options.redisOptions;
      }
      const { host, port } = options;
      span.setAttributes({
        [SemanticAttributes.NET_PEER_NAME]: host,
        [SemanticAttributes.NET_PEER_PORT]: port,
      })

      original.call(this, commandObj.command);
      endSpan(span, null);
    }
  }
}

export function unpatch (redis: Redis) {
  shimmer.unwrap(redis, 'sendCommand');
}

function endSpan(span: Span, err: NodeJS.ErrnoException | null | undefined) {
  if (err) {
    span.recordException(err);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
  }
  span.end();
}

interface IORedisCommand {
  reject: (err: Error) => void;
  resolve: (result: {}) => void;
  promise: Promise<{}>;
  args: Array<string | Buffer | number>;
  callback: any;
  name: string;
}

module.exports = {
  name: 'redis_instrumentation',
  patch,
  unpatch,
}