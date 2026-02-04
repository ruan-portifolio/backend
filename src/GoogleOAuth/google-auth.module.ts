import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './google-auth.controller';
import { AppService } from './google-auth.service';
import { TenantUser } from '../entities/tenant-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TenantUser])],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class GoogleAuthModule {}
