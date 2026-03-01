import {
  Controller,
  Get,
  Post,
  Body,
  Sse,
  Query,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { EventsService, DeviceEvent } from './events.service';
import { PinAuthService } from '../auth/pin-auth.service';

interface MessageEvent {
  data: string;
}

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(
    private eventsService: EventsService,
    private pinAuthService: PinAuthService,
  ) {}

  /**
   * SSE endpoint for real-time device update notifications
   * Clients connect here to receive push notifications when content changes
   *
   * Note: SSE doesn't support custom headers, so we use query param for auth
   */
  @Public()
  @Get('stream')
  @Sse()
  deviceUpdates(@Query('token') token: string): Observable<MessageEvent> {
    // Validate session token from query parameter
    if (!token || token.length > 128) {
      throw new UnauthorizedException('Authentication token required');
    }

    if (!this.pinAuthService.validateSession(token)) {
      this.logger.warn('Invalid SSE authentication token');
      throw new UnauthorizedException('Invalid authentication token');
    }

    this.logger.log('New SSE client connected');

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat$ = interval(30000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
      })),
    );

    // Stream of actual events
    const events$ = this.eventsService.getEventStream().pipe(
      map((event: DeviceEvent) => ({
        data: JSON.stringify(event),
      })),
    );

    // Merge heartbeat and events
    return merge(heartbeat$, events$);
  }

  /**
   * Endpoint to manually trigger device notifications
   * Used by frontend after mutations
   * Protected by global PinAuthGuard
   */
  @Post('notify')
  async notify(
    @Body()
    body: {
      type: 'screen' | 'playlist' | 'screen_design' | 'devices';
      id?: number;
      deviceIds?: number[];
    },
  ) {
    switch (body.type) {
      case 'screen':
        if (body.id) {
          await this.eventsService.notifyScreenUpdate(body.id);
        }
        break;
      case 'playlist':
        if (body.id) {
          await this.eventsService.notifyPlaylistUpdate(body.id);
        }
        break;
      case 'screen_design':
        if (body.id) {
          await this.eventsService.notifyScreenDesignUpdate(body.id);
        }
        break;
      case 'devices':
        if (body.deviceIds && body.deviceIds.length > 0) {
          await this.eventsService.notifyDevicesRefresh(body.deviceIds);
        }
        break;
    }

    return { success: true };
  }
}
