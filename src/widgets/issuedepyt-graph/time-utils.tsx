export type DurationMs = number;
export type DurationDays = number;

export const isPastDate = (date: Date): boolean => {
  return new Date().getTime() > date.getTime();
};

export const getDuration = (firstDate: Date, secondDate: Date): DurationMs => {
  return secondDate.getTime() - firstDate.getTime();
};

export const durationToDays = (duration: DurationMs): number => {
  return Math.floor(duration / (1000 * 60 * 60 * 24));
};

/** Convert date diff to business days.
 * Implementation taken from https://snipplr.com/view/4086/calculate-business-days-between-two-dates
 */
export const calcBusinessDays = (dDate1: Date, dDate2: Date): number => {
  var iAdjust = 0;

  if (dDate2 < dDate1) return -1; // error code if dates transposed

  var iWeekday1 = dDate1.getDay(); // day of week
  var iWeekday2 = dDate2.getDay();

  iWeekday1 = iWeekday1 == 0 ? 7 : iWeekday1; // change Sunday from 0 to 7
  iWeekday2 = iWeekday2 == 0 ? 7 : iWeekday2;

  if (iWeekday1 > 5 && iWeekday2 > 5) iAdjust = 1; // adjustment if both days on weekend

  iWeekday1 = iWeekday1 > 5 ? 5 : iWeekday1; // only count weekdays
  iWeekday2 = iWeekday2 > 5 ? 5 : iWeekday2;

  // calculate differnece in weeks (1000mS * 60sec * 60min * 24hrs * 7 days = 604800000)
  const iWeeks = Math.floor((dDate2.getTime() - dDate1.getTime()) / 604800000);

  var iDateDiff;
  if (iWeekday1 <= iWeekday2) {
    iDateDiff = iWeeks * 5 + (iWeekday2 - iWeekday1);
  } else {
    iDateDiff = (iWeeks + 1) * 5 - (iWeekday1 - iWeekday2);
  }

  iDateDiff -= iAdjust; // take into account both days on weekend

  return iDateDiff + 1; // add 1 because dates are inclusive
};
