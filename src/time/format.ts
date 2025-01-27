import {DateTime} from 'luxon';

const timeFormats = {
    AR: {
        yearOffset: 2700,
        Era: 'AR',
        Months: {
            'January': 'Abadius',
            'February': 'Calistril',
            'March': 'Pharast',
            'April': 'Gozran',
            'May': 'Desnus',
            'June': 'Sarenith',
            'July': 'Erastus',
            'August': 'Arodus',
            'September': 'Rova',
            'October': 'Lamashan',
            'November': 'Neth',
            'December': 'Kuthona',
        },
        'Weekdays': {
            'Monday': 'Moonday',
            'Tuesday': 'Toilday',
            'Wednesday': 'Wealday',
            'Thursday': 'Oathday',
            'Friday': 'Fireday',
            'Saturday': 'Starday',
            'Sunday': 'Sunday',
        },
    },
};

const pr = new Intl.PluralRules('en-US', {
    type: 'ordinal',
});
const suffixes = new Map([
    ['one', 'st'],
    ['two', 'nd'],
    ['few', 'rd'],
    ['other', 'th'],
]);

function formatOrdinals(n: number): string {
    const rule = pr.select(n);
    const suffix = suffixes.get(rule);
    return `${n}${suffix}`;
}

export function calculateYear(dateTime: DateTime, mode: 'AR'): number {
    return dateTime.year + timeFormats[mode].yearOffset;
}

export function formatWorldTime(worldTime: DateTime, mode: 'AR'): string {
    const format = timeFormats[mode];
    // convert to map to get TS to like indexing config
    const weekday = new Map(Object.entries(format.Weekdays)).get(worldTime.weekdayLong != null ? worldTime.weekdayLong! : "Monday");
    const month = new Map(Object.entries(format.Months)).get(worldTime.monthLong != null ? worldTime.monthLong! : "January");
    const year = calculateYear(worldTime, mode);
    const time = worldTime.toFormat('hh:mm:ss');
    const era = format.Era;
    const day = formatOrdinals(worldTime.day);
    return `${weekday}, ${day} of ${month}, ${year} ${era} (${time})`;
}
