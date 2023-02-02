import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.module';
import { CreateCatDto } from './dto/create.cat.dto';

@Injectable()
export class CatsService {
  private expired: number;
  index = 0;

  constructor(private readonly redisService: RedisService) {
    this.expired = 10;
  }

  async create(createCatDto: CreateCatDto): Promise<'OK'> {
    return this.redisService.set(
      this.index++,
      JSON.stringify(createCatDto),
      'NX',
      'EX',
      this.expired,
    );
  }

  async get(id: number) {
    const cat = await this.redisService.get(id);
    if (cat) {
      return JSON.parse(cat);
    }
  }
}
