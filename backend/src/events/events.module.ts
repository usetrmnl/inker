import { Module, Global } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
