import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster, RedisKey } from 'ioredis';
import { promisify } from 'util';
import { TraceService } from './../trace/trace.service';

@Injectable()
export class RedisService {
  get;
  set;
  expire;
  incr;
  del;

  constructor(
    private readonly config: ConfigService,
    private readonly traceService: TraceService,
  ) {
    let client: Redis | Cluster;
    const mode = config.get('REDIS_MODE')
      ? config.get('REDIS_MODE')
      : 'Standalone';
    const options = {};
    switch (mode) {
      case 'SENTINEL':
        options['sentinels'] = [
          { host: config.get('REDIS_HOST'), port: config.get('REDIS_PORT') },
        ];
        options['name'] = 'mymaster';
        if (config.get('REDIS_USERNAME'))
          options['username'] = config.get('REDIS_USERNAME');
        if (config.get('REDIS_PASSWORD')) {
          options['password'] = config.get('REDIS_PASSWORD');
          options['sentinelPassword'] = config.get('REDIS_PASSWORD');
        }
        client = new Redis(options);
        break;
      case 'CLUSTER':
        const hosts = config.get('REDIS_HOST').split(',');
        const ports = config.get('REDIS_PORT').split(',');
        const startupNodes = [];
        for (let index = 0; index < hosts.length; index++) {
          startupNodes.push({ host: hosts[index], port: Number(ports[index]) });
        }
        options['redisOptions'] = {};
        if (config.get('REDIS_USERNAME'))
          options['redisOptions']['username'] = config.get('REDIS_USERNAME');
        if (config.get('REDIS_PASSWORD')) {
          options['redisOptions']['password'] = config.get('REDIS_PASSWORD');
        }
        client = new Redis.Cluster(startupNodes, options);
        break;
      default:
        options['host'] = config.get('REDIS_HOST');
        options['port'] = config.get('REDIS_PORT');
        if (config.get('REDIS_USERNAME'))
          options['username'] = config.get('REDIS_USERNAME');
        if (config.get('REDIS_PASSWORD')) {
          options['password'] = config.get('REDIS_PASSWORD');
        }
        client = new Redis(options);
        break;
    }

    client.on('connect', () => {
      console.log(`Redis connect >>> ${mode}`);
    });

    client.on('error', (err) => {
      console.log(err);
    });

    const clientOptions = client.options;

    this.get = async (key: RedisKey) => { 
      const params = { key };
      const span = this.traceService.startCacheSpan('get', clientOptions, params);
      const result = await promisify(client.get).bind(client)(key);
      span.end();
      return result;
    }
    this.set = async (key: RedisKey, value: string | number | Buffer) => {
      const params = { key, value };
      const span = this.traceService.startCacheSpan('set', clientOptions, params);
      const result = await promisify(client.set).bind(client)(key, value);
      span.end();
      return result;
    }
    this.expire = async (key: RedisKey, seconds: string | number) => {
      const params = { key, value: seconds };
      const span = this.traceService.startCacheSpan('expire', clientOptions, params);
      const result = await promisify(client.expire).bind(client)(key, seconds);
      span.end();
      return result;
    }
    this.incr = async (key: RedisKey) => {
      const params = { key };
      const span = this.traceService.startCacheSpan('incr', clientOptions, params);
      const result = await promisify(client.incr).bind(client)(key);
      span.end();
      return result;
    }
    this.del = async (key: RedisKey) => {
      const params = { key };
      const span = this.traceService.startCacheSpan('del', clientOptions, params);
      const result = await promisify(client.del).bind(client)(key);
      span.end();
      return result;
    }

    // this.get = promisify(client.get).bind(client);
    // this.set = promisify(client.set).bind(client);
    // this.expire = promisify(client.expire).bind(client);
    // this.incr = promisify(client.incr).bind(client);
    // this.del = promisify(client.del).bind(client);
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
