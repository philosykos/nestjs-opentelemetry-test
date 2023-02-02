import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatsModule } from './cats/cats.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [CatsModule, RedisModule, ConfigModule.forRoot({
    isGlobal: true,
    expandVariables: true,
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
