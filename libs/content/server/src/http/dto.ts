import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
export class PageQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;
}
export class RevisionInput {
  @ApiProperty() @IsString() @Length(1, 160) title!: string;
  @ApiProperty() @IsString() @Length(1, 320) summary!: string;
  @ApiProperty() @IsString() @Length(1, 100000) body!: string;
}
export class CreatePostInput extends RevisionInput {
  @ApiProperty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(1, 120)
  slug!: string;
}
export class EditInput extends RevisionInput {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class ScheduleInput {
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  scheduledAt!: string;
}
export class AssignInput {
  @ApiProperty() @IsString() @Length(1, 128) userId!: string;
}
export class PublicPostSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ format: "date-time" }) publishedAt!: string;
}
export class PublicPostDto extends PublicPostSummaryDto {
  @ApiProperty() body!: string;
}
export class RevisionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() body!: string;
  @ApiProperty() status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true, type: String }) scheduledAt!: string | null;
}
export class EditorialPostDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty({ nullable: true, type: String }) assignedToId!: string | null;
  @ApiProperty({ type: [RevisionDto] }) revisions!: RevisionDto[];
}
