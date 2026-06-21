import {
  Controller,
  Post,
  Delete,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { memoryStorage } from 'multer';
import { StorageService } from '../storage/storage.service';

@Controller('uploads')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(AuthGuard('business-jwt'))
  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, WebP allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.storageService.uploadProductImage(file, req.user.businessId);
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Delete(':key(*)')
  async deleteImage(@Param('key') key: string, @Request() req) {
    // Verify the key belongs to this business
    const prefix = `products/${req.user.businessId}/`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('You can only delete your own images');
    }
    await this.storageService.deleteObject(key);
    return { deleted: true, key };
  }
}
