import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

const SPEC_DOC =
  'A query: `filters` (each `{ column, op, value }`; `op` is `equals`, `contains`, `greater`, `less`, `empty` or `not_empty`), ' +
  '`groupBy` (up to 2 columns), `measures` (1 to 4 of `{ fn, column }`; `fn` is `count`, `sum`, `average`, `min`, `max` or `distinct`; `count` takes no column), ' +
  'an optional `sort` (`{ by: "group" | "measure", index, direction: "asc" | "desc" }`) and a `limit` (1 to 200, default 50). ' +
  'Example: `{ "groupBy": ["region"], "measures": [{ "fn": "sum", "column": "revenue" }], "sort": { "by": "measure", "index": 0, "direction": "desc" } }`.';

export class ExploreRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true, description: SPEC_DOC })
  @IsObject()
  query!: Record<string, unknown>;
}

export class AskRequestDto {
  @ApiProperty({ description: 'A question about the file, in words. The assistant is shown it and the column names and types, never a value.', example: 'Total revenue by region, highest first' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}

export class ResultColumnDto {
  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: ['group', 'measure'] })
  @Expose()
  kind!: 'group' | 'measure';
}

export class QueryResultDto {
  @ApiProperty({ type: [ResultColumnDto], description: 'The group-by columns first, then one column per measure.' })
  @Expose()
  @Type(() => ResultColumnDto)
  columns!: ResultColumnDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }], nullable: true } },
    description: 'One row per group (one row in all when there is no `groupBy`), cells in the order of `columns`. A measure that has nothing to work on is null.',
  })
  @Expose()
  rows!: Array<Array<string | number | null>>;

  @ApiProperty({ description: 'Rows that passed the filters.' })
  @Expose()
  rowsMatched!: number;

  @ApiProperty({ description: 'Rows in the file.' })
  @Expose()
  rowsScanned!: number;

  @ApiProperty({ description: 'How many groups there were before `limit` cut the list.' })
  @Expose()
  groupCount!: number;

  @ApiProperty({ type: [String], description: 'Things worth saying, such as cells that were not numbers and were left out.' })
  @Expose()
  notes!: string[];
}

export class AskResultDto {
  @ApiProperty()
  @Expose()
  question!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: `The query the assistant planned, validated and run by the server. ${SPEC_DOC}` })
  @Expose()
  spec!: Record<string, unknown>;

  @ApiProperty({ type: QueryResultDto })
  @Expose()
  @Type(() => QueryResultDto)
  result!: QueryResultDto;

  @ApiProperty({ type: String, nullable: true, description: 'The model that planned the query.' })
  @Expose()
  model!: string | null;

  @ApiProperty({ description: "Questions answered so far this billing period, this one included." })
  @Expose()
  questionsUsed!: number;

  @ApiProperty({ description: "Questions the plan answers a billing period." })
  @Expose()
  questionsLimit!: number;
}

export class AllowanceDto {
  @ApiProperty({ description: 'False when the AI assistant is switched off on this server: the query builder still works.' })
  @Expose()
  aiAvailable!: boolean;

  @ApiProperty()
  @Expose()
  questionsUsed!: number;

  @ApiProperty()
  @Expose()
  questionsLimit!: number;
}
