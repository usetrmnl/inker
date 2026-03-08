import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('DevicesController (e2e)', () => {
  let app: INestApplication;

  const mockDevice = {
    id: 1,
    name: 'Test Device',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    apiKey: 'test-api-key',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDevicesService = {
    create: async () => mockDevice,
    findAll: async () => ({
      items: [mockDevice],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    findOne: async () => mockDevice,
    update: async () => ({ ...mockDevice, name: 'Updated Device' }),
    remove: async () => ({ message: 'Device deleted successfully' }),
    regenerateApiKey: async () => ({ deviceId: 1, apiKey: 'new-api-key' }),
    getDeviceLogs: async () => [],
    triggerRefresh: async () => ({ message: 'Device refresh triggered', deviceId: 1 }),
    unassignPlaylist: async () => ({ message: 'Playlist unassigned successfully' }),
    getDisplayContent: async () => ({ deviceId: 1, screen: null }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        { provide: DevicesService, useValue: mockDevicesService },
      ],
    })
      .overrideGuard(PinAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /devices', () => {
    it('should return paginated list of devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/devices')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /devices/:id', () => {
    it('should return a device by ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/devices/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test Device');
    });
  });

  describe('POST /devices', () => {
    it('should create a new device', async () => {
      const response = await request(app.getHttpServer())
        .post('/devices')
        .send({ name: 'New Device', macAddress: 'AA:BB:CC:DD:EE:FF' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('macAddress');
    });
  });

  describe('PATCH /devices/:id', () => {
    it('should update a device', async () => {
      const response = await request(app.getHttpServer())
        .patch('/devices/1')
        .send({ name: 'Updated Device' })
        .expect(200);

      expect(response.body.data).toHaveProperty('name', 'Updated Device');
    });
  });

  describe('DELETE /devices/:id', () => {
    it('should delete a device', async () => {
      const response = await request(app.getHttpServer())
        .delete('/devices/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Device deleted successfully');
    });
  });
});
