import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('PlaylistsController (e2e)', () => {
  let app: INestApplication;

  const mockPlaylist = {
    id: 1,
    name: 'Test Playlist',
    description: 'A test playlist',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
  };

  const mockPlaylistsService = {
    create: async () => mockPlaylist,
    findAll: async () => ({
      items: [mockPlaylist],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    findOne: async () => ({ ...mockPlaylist, screens: [], devices: [] }),
    update: async () => ({ ...mockPlaylist, name: 'Updated Playlist' }),
    remove: async () => ({ message: 'Playlist deleted successfully', unassignedDevices: 0 }),
    addItem: async () => ({ id: 1, playlistId: 1, screenId: 1, order: 0, duration: 60 }),
    updateItem: async () => ({ id: 1, playlistId: 1, screenId: 1, order: 0, duration: 120 }),
    removeItem: async () => ({ message: 'Playlist item removed successfully' }),
    reorderItems: async () => ({ message: 'Playlist items reordered successfully' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [
        { provide: PlaylistsService, useValue: mockPlaylistsService },
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

  describe('GET /playlists', () => {
    it('should return paginated list of playlists', async () => {
      const response = await request(app.getHttpServer())
        .get('/playlists')
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /playlists/:id', () => {
    it('should return a playlist by ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/playlists/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test Playlist');
    });
  });

  describe('POST /playlists', () => {
    it('should create a new playlist', async () => {
      const response = await request(app.getHttpServer())
        .post('/playlists')
        .send({ name: 'New Playlist' })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
    });
  });

  describe('DELETE /playlists/:id', () => {
    it('should delete a playlist', async () => {
      const response = await request(app.getHttpServer())
        .delete('/playlists/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('message', 'Playlist deleted successfully');
    });
  });
});
