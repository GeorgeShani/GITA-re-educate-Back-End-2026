import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

// Ported verbatim from Homework 24/26 — rejects malformed ids before they
// ever reach a service/query, so a bad :id in the URL is a clean 400
// instead of a confusing Mongoose CastError further down the stack.
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`Invalid id: ${value}`);
    }

    return value;
  }
}
