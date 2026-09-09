import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDirectorDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  birthYear?: number;

  @IsOptional()
  @IsString()
  nationality?: string;
}
