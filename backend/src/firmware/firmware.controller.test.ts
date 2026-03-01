import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('FirmwareController (e2e)', () => {
  let app: INestApplication;

  const mockFirmware = {
    id: 1,
    version: '1.0.0',
    downloadUrl: 'https://example.com/firmware/1.0.0.bin',
    releaseNotes: 'Initial release',
    isStable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockFirmwareService = {
    create: async () => mockFirmware,
    findAll: async () => ({ items: [mockFirmware], total: 1 }),
    findOne: async () => mockFirmware,
    findLatestStable: async () => mockFirmware,
    findByVersion: async () => mockFirmware,
    update: async () => ({ ...mockFirmware, releaseNotes: 'Updated notes' }),
    remove: async () => ({ message: 'Firmware deleted successfully' }),
    markAsStable: async () => ({ ...mockFirmware, isStable: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FirmwareController],
      providers: [
        { provide: FirmwareService, useValue: mockFirmwareService },
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

  describe('GET /firmware', () => {
    it('should return list of firmware versions', async () => {
      const response = await request(app.getHttpServer())
        .get('/firmware')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('POST /firmware', () => {
    it('should create a new firmware version', async () => {
      const response = await request(app.getHttpServer())
        .post('/firmware')
        .send({ version: '1.0.0', downloadUrl: 'https://example.com/fw.bin' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('version', '1.0.0');
    });
  });

  describe('PATCH /firmware/:id', () => {
    it('should update a firmware version', async () => {
      const response = await request(app.getHttpServer())
        .patch('/firmware/1')
        .send({ releaseNotes: 'Updated notes' })
        .expect(200);

      expect(response.body.data).toHaveProperty('releaseNotes', 'Updated notes');
    });
  });
});
