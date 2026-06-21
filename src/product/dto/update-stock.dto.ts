import { IsInt, IsIn, Min } from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  @Min(0)
  quantity: number;

  @IsIn(['set', 'increment', 'decrement'])
  operation: 'set' | 'increment' | 'decrement';
}
