import { describe, it, expect, beforeEach } from 'bun:test';
import { firstValueFrom } from 'rxjs';
import { EventsService, DeviceEvent } from './events.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';
import { createMock } from '../test/mocks/helpers';

describe('EventsService', () => {
  let service: EventsService;
  let mockPrisma: MockPrisma & { deviceScreenAssignment: any };

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    // Add deviceScreenAssignment model (not in default mock)
    mockPrisma.deviceScreenAssignment = {
      findMany: createMock(),
    };
    service = new EventsService(mockPrisma as any);
  });

  // ─── emit / getEventStream ─────────────────────────────────────────

  describe('emit() and getEventStream()', () => {
    it('should emit events that can be received via getEventStream', async () => {
      const event: DeviceEvent = {
        type: 'device:refresh',
        payload: { deviceIds: [1], timestamp: Date.now() },
      };

      const eventPromise = firstValueFrom(service.getEventStream());
      service.emit(event);

      const received = await eventPromise;
      expect(received.type).toBe('device:refresh');
      expect(received.payload.deviceIds).toEqual([1]);
    });
  });

  // ─── getEventsForDevices ───────────────────────────────────────────

  describe('getEventsForDevices()', () => {
    it('should filter events by matching deviceIds', async () => {
      const stream = service.getEventsForDevices([1, 2]);

      const eventPromise = firstValueFrom(stream);

      service.emit({
        type: 'device:refresh',
        payload: { deviceIds: [2, 3], timestamp: Date.now() },
      });

      const received = await eventPromise;
      expect(received.payload.deviceIds).toEqual([2, 3]);
    });

    it('should pass through events with no deviceIds (broadcast)', async () => {
      const stream = service.getEventsForDevices([1]);

      const eventPromise = firstValueFrom(stream);

      service.emit({
        type: 'playlist:updated',
        payload: { playlistId: 5, timestamp: Date.now() },
      });

      const received = await eventPromise;
      expect(received.type).toBe('playlist:updated');
    });

    it('should filter out events targeting other devices', (done) => {
      const stream = service.getEventsForDevices([1]);

      let receivedCount = 0;
      const subscription = stream.subscribe((event) => {
        receivedCount++;
        // Only the second event should arrive (broadcast)
        expect(event.type).toBe('screen:updated');
        subscription.unsubscribe();
        done();
      });

      // This should be filtered out (device 99 not in [1])
      service.emit({
        type: 'device:refresh',
        payload: { deviceIds: [99], timestamp: Date.now() },
      });

      // This should pass through (no deviceIds = broadcast)
      service.emit({
        type: 'screen:updated',
        payload: { screenId: 1, timestamp: Date.now() },
      });
    });
  });

  // ─── notifyScreenUpdate ────────────────────────────────────────────

  describe('notifyScreenUpdate()', () => {
    it('should find playlist items, collect device IDs, set refreshPending, and emit', async () => {
      mockPrisma.playlistItem.findMany.mockResolvedValue([
        {
          playlist: {
            devices: [{ id: 10 }, { id: 20 }],
          },
        },
        {
          playlist: {
            devices: [{ id: 20 }, { id: 30 }],
          },
        },
      ]);
      mockPrisma.device.updateMany.mockResolvedValue({ count: 3 });

      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyScreenUpdate(5);

      // Should deduplicate device IDs
      expect(mockPrisma.device.updateMany.calls).toHaveLength(1);
      const updateCall = mockPrisma.device.updateMany.calls[0][0];
      expect(updateCall.where.id.in).toContain(10);
      expect(updateCall.where.id.in).toContain(20);
      expect(updateCall.where.id.in).toContain(30);
      expect(updateCall.data.refreshPending).toBe(true);

      const event = await eventPromise;
      expect(event.type).toBe('screen:updated');
      expect(event.payload.screenId).toBe(5);
    });

    it('should emit event even when no devices are affected', async () => {
      mockPrisma.playlistItem.findMany.mockResolvedValue([]);

      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyScreenUpdate(5);

      // Should NOT call updateMany when no devices
      expect(mockPrisma.device.updateMany.calls).toHaveLength(0);

      const event = await eventPromise;
      expect(event.type).toBe('screen:updated');
      expect(event.payload.deviceIds).toEqual([]);
    });
  });

  // ─── notifyPlaylistUpdate ──────────────────────────────────────────

  describe('notifyPlaylistUpdate()', () => {
    it('should find devices, set refreshPending, and emit event', async () => {
      mockPrisma.device.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.device.updateMany.mockResolvedValue({ count: 2 });

      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyPlaylistUpdate(7);

      expect(mockPrisma.device.findMany.calls).toHaveLength(1);
      expect(mockPrisma.device.findMany.calls[0][0].where.playlistId).toBe(7);
      expect(mockPrisma.device.updateMany.calls).toHaveLength(1);
      expect(mockPrisma.device.updateMany.calls[0][0].data.refreshPending).toBe(true);

      const event = await eventPromise;
      expect(event.type).toBe('playlist:updated');
      expect(event.payload.playlistId).toBe(7);
      expect(event.payload.deviceIds).toEqual([1, 2]);
    });

    it('should emit event even with no devices on playlist', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyPlaylistUpdate(7);

      expect(mockPrisma.device.updateMany.calls).toHaveLength(0);

      const event = await eventPromise;
      expect(event.type).toBe('playlist:updated');
      expect(event.payload.deviceIds).toEqual([]);
    });
  });

  // ─── notifyDevicesRefresh ──────────────────────────────────────────

  describe('notifyDevicesRefresh()', () => {
    it('should NOT call updateMany for empty device array', async () => {
      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyDevicesRefresh([]);

      expect(mockPrisma.device.updateMany.calls).toHaveLength(0);

      const event = await eventPromise;
      expect(event.type).toBe('device:refresh');
      expect(event.payload.deviceIds).toEqual([]);
    });

    it('should set refreshPending and emit event for non-empty array', async () => {
      mockPrisma.device.updateMany.mockResolvedValue({ count: 2 });

      const eventPromise = firstValueFrom(service.getEventStream());

      await service.notifyDevicesRefresh([5, 10]);

      expect(mockPrisma.device.updateMany.calls).toHaveLength(1);
      expect(mockPrisma.device.updateMany.calls[0][0].where.id.in).toEqual([5, 10]);
      expect(mockPrisma.device.updateMany.calls[0][0].data.refreshPending).toBe(true);

      const event = await eventPromise;
      expect(event.type).toBe('device:refresh');
      expect(event.payload.deviceIds).toEqual([5, 10]);
    });
  });
});
