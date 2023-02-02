import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import Redis, { Cluster } from 'ioredis';

@Injectable()
export class RedisService {
  get;
  set;
  expire;
  incr;
  del;

  constructor(
    private readonly config: ConfigService,
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

    this.get = promisify(client.get).bind(client);
    this.set = promisify(client.set).bind(client);
    this.expire = promisify(client.expire).bind(client);
    this.incr = promisify(client.incr).bind(client);
    this.del = promisify(client.del).bind(client);
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
