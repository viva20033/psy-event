/**
 * Расписание интенсива 2026 (19 июня — 1 июля).
 * Источник: сканы расписания 2024, даты сдвинуты на −1 день.
 * Генерация: node scripts/generate-schedule-sql.mjs
 */

/** @typedef {{ start: string, end: string, title: string, description?: string }} Slot */

/** @param {number} dayIndex 0..12 */
export function dateForDayIndex(dayIndex) {
  const d = new Date(2026, 5, 19); // 19 June 2026
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CHILD_NOTE = 'Детские группы не работают';

/** @returns {Slot[]} */
function standardTrainingDay(opts = {}) {
  const {
    lectureTitle = 'Лекция',
    processTitle = 'Процесс-группа',
    evening = [],
  } = opts;
  return [
    { start: '08:30', end: '09:00', title: 'Завтрак' },
    { start: '09:30', end: '10:15', title: lectureTitle },
    { start: '10:30', end: '12:00', title: 'Тематическая группа' },
    { start: '12:15', end: '12:55', title: 'Индивидуальная терапия' },
    { start: '12:55', end: '13:15', title: 'Супервизия' },
    { start: '13:00', end: '14:00', title: 'Обед' },
    {
      start: '14:30',
      end: '15:10',
      title: 'Индивидуальная терапия',
      description: CHILD_NOTE,
    },
    {
      start: '15:10',
      end: '15:30',
      title: 'Супервизия',
      description: CHILD_NOTE,
    },
    { start: '15:50', end: '17:20', title: 'Тематическая группа' },
    { start: '17:40', end: '18:30', title: processTitle },
    { start: '18:30', end: '19:30', title: 'Ужин' },
    ...evening,
  ];
}

/** @type {Record<number, Slot[]>} */
export const scheduleByDayIndex = {
  // Регистрационный день — 19 июня
  0: [
    { start: '11:00', end: '17:00', title: 'Регистрация участников' },
    { start: '13:00', end: '14:00', title: 'Обед' },
    { start: '17:40', end: '18:30', title: 'Собрание родителей и детей' },
    { start: '18:30', end: '19:30', title: 'Ужин' },
    {
      start: '19:00',
      end: '20:30',
      title: 'Открытие интенсива, распределение по группам',
    },
  ],

  // Трехдневка 1
  1: standardTrainingDay({
    lectureTitle:
      'Лекция. Распределение в пары терапевт-клиент, терапевт-супервизор. Выбор терапевтов подростками',
    processTitle: 'Распределение на процесс-группы. Процесс-группа',
  }),
  2: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '19:30',
        title: 'Родительский клуб',
        description: 'Лекция / беседа для родителей',
      },
      {
        start: '19:30',
        end: '20:00',
        title: 'Встреча родителей с тренерами детских групп',
      },
      {
        start: '20:00',
        end: '21:00',
        title: 'Группа поддержки подростковых терапевтов',
      },
    ],
  }),
  3: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '20:00',
        title: 'Завершение трехдневки. Передача тренеров',
      },
    ],
  }),

  4: [{ start: '09:00', end: '18:00', title: 'Выходной', description: 'Группы не работают' }],

  // Трехдневка 2
  5: standardTrainingDay(),
  6: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '20:00',
        title: 'Родительский клуб',
        description: 'Лекция / беседа для родителей',
      },
      {
        start: '20:00',
        end: '21:00',
        title: 'Группа поддержки подростковых терапевтов',
      },
    ],
  }),
  7: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '20:00',
        title: 'Завершение трехдневки. Передача тренеров',
      },
    ],
  }),

  8: [{ start: '09:00', end: '18:00', title: 'Выходной', description: 'Группы не работают' }],

  // Трехдневка 3
  9: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '20:30',
        title: 'Родительский клуб',
        description: 'Лекция / беседа для родителей',
      },
    ],
  }),
  10: standardTrainingDay({
    evening: [
      {
        start: '19:00',
        end: '20:00',
        title: 'Встреча родителей с тренерами детских групп',
      },
      {
        start: '20:00',
        end: '21:00',
        title: 'Группа поддержки подростковых терапевтов',
      },
    ],
  }),
  11: standardTrainingDay({
    evening: [
      { start: '19:00', end: '20:30', title: 'Завершение интенсива' },
    ],
  }),

  // 1 июля — отъезд
  12: [
    {
      start: '06:00',
      end: '08:30',
      title: 'Отъезд',
      description: 'До 08:30',
    },
  ],
};

export const dayDates = Object.fromEntries(
  Array.from({ length: 13 }, (_, i) => [i, dateForDayIndex(i)]),
);
