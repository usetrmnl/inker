import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PinAuthService } from './pin-auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly pinAuthService: PinAuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with PIN' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  async login(@Body() loginDto: LoginDto) {
    const isValid = this.pinAuthService.validatePin(loginDto.pin);

    if (!isValid) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const token = this.pinAuthService.generateSessionToken();

    return {
      token,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@Headers('authorization') authHeader: string) {
    if (authHeader) {
      const [, token] = authHeader.split(' ');
      if (token) {
        this.pinAuthService.invalidateSession(token);
      }
    }

    return { message: 'Logout successful' };
  }

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate current session' })
  @ApiResponse({ status: 200, description: 'Session valid' })
  @ApiResponse({ status: 401, description: 'Session invalid' })
  async validate(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('No session token');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid token format');
    }

    const isValid = this.pinAuthService.validateSession(token);
    if (!isValid) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    return { valid: true };
  }
}
