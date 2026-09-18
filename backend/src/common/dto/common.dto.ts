import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Base pagination DTO
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc" = "desc";
}

/**
 * ID parameter DTO
 */
export class IdParamDto {
  @IsString()
  id: string;
}

/**
 * Soft delete awareness DTO
 */
export class WithDeletedDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  withDeleted?: boolean = false;
}

/**
 * Date range filter DTO
 */
export class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}
