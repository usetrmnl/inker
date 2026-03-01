import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { PinAuthService } from './pin-auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const mockPinAuthService = {
    validatePin: (pin: string) => pin === '1234',
    generateSessionToken: () => 'test-session-token',
    invalidateSession: () => {},
    validateSession: (token: string) => token === 'valid-token',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: PinAuthService, useValue: mockPinAuthService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /auth/login', () => {
    it('should return token for valid PIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ pin: '1234' })
        .expect(200);

      expect(response.body.token).toBe('test-session-token');
      expect(response.body.message).toBe('Login successful');
    });

    it('should return 401 for invalid PIN', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ pin: '0000' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('POST /auth/validate', () => {
    it('should return valid for valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/validate')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.valid).toBe(true);
    });

    it('should return 401 for missing header', async () => {
      await request(app.getHttpServer())
        .post('/auth/validate')
        .expect(401);
    });

    it('should return 401 for invalid token format', async () => {
      await request(app.getHttpServer())
        .post('/auth/validate')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should return 401 for expired session', async () => {
      await request(app.getHttpServer())
        .post('/auth/validate')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);
    });
  });
});
