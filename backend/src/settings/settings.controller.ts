import { Controller, Get, Put, Post, Delete, Param, Body, BadRequestException } from '@nestjs/common';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { TestGitHubTokenDto } from './dto/test-github-token.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Test a GitHub token before saving
   */
  @Post('test-github-token')
  async testGitHubToken(@Body() body: TestGitHubTokenDto) {
    return this.settingsService.testGitHubToken(body.token);
  }

  /**
   * Get all settings (with sensitive values masked)
   */
  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  /**
   * Get known setting keys
   */
  @Get('keys')
  getKeys() {
    return SETTING_KEYS;
  }

  /**
   * Update a setting
   */
  @Put(':key')
  async update(@Param('key') key: string, @Body() body: UpdateSettingDto) {
    const allowedKeys = Object.values(SETTING_KEYS);
    if (!allowedKeys.includes(key as any)) {
      throw new BadRequestException(`Invalid setting key: ${key}. Allowed keys: ${allowedKeys.join(', ')}`);
    }
    await this.settingsService.set(key, body.value);
    return { success: true };
  }

  /**
   * Delete a setting
   */
  @Delete(':key')
  async delete(@Param('key') key: string) {
    const allowedKeys = Object.values(SETTING_KEYS);
    if (!allowedKeys.includes(key as any)) {
      throw new BadRequestException(`Invalid setting key: ${key}. Allowed keys: ${allowedKeys.join(', ')}`);
    }
    await this.settingsService.delete(key);
    return { success: true };
  }
}
