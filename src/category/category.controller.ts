import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Category } from './entities/category.entity';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Public: list all categories with hierarchy
  @Get()
  async findAll(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  // Guarded: create a category (business-jwt until admin module exists)
  @UseGuards(AuthGuard('business-jwt'))
  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(createCategoryDto);
  }

  // Public: get a category by slug
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoryService.findBySlug(slug);
  }
}
