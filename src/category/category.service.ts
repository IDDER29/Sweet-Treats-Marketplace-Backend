import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CacheService } from '../redis/cache.service';

const CATEGORIES_CACHE_KEY = 'categories:all';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
    });

    if (dto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
      category.parent = parent;
    }

    try {
      const saved = await this.categoryRepository.save(category);
      // Invalidate the cached tree so the new category appears immediately.
      await this.cache.del(CATEGORIES_CACHE_KEY);
      return saved;
    } catch (err) {
      // Postgres unique_violation on name/slug -> 409 instead of a raw 500.
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(
          'A category with that name or slug already exists',
        );
      }
      throw err;
    }
  }

  async findAll(): Promise<Category[]> {
    // Cache-aside: categories change rarely but are read on most catalog pages.
    return this.cache.wrap(CATEGORIES_CACHE_KEY, 300, () =>
      this.categoryRepository.find({ relations: ['children'] }),
    );
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
