import { Gender } from '../enums/gender.enum';

export interface GenderStatistic {
  gender: Gender;
  /** Number of users of this gender. */
  count: number;
  /** Average age of users of this gender, rounded to one decimal place. */
  averageAge: number;
}
