import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy', schema: { example: { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' } } })
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}