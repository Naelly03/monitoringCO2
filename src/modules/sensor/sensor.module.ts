import { Module } from '@nestjs/common';
import { SensorController } from './sensor.controller';
import { PrismaService } from '../../prisma.service';
import { SensorService } from './sensor.service';

@Module({
  controllers: [SensorController], 
  providers: [PrismaService, SensorService], 
})
export class SensorModule {}