'use strict';

import {
  jalaliToIso,
  jalaliMonthDays,
  isoToJalali
} from '../../core/date/jalali.js';

const J_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

const J_WEEK_DAYS = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج'
];

const todayIso = () =>
  new Date().toISOString().slice(0, 10);

const dateFa = iso => {
  try {
    return new Intl.DateTimeFormat(
      'fa-IR-u-ca-persian',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).format(
      new Date(iso + 'T12:00:00')
    );
  } catch {
    return iso || '—';
  }
};

export function jalalizeDateInputs(root = document) {

  root
    .querySelectorAll(
      'input[type="date"]:not([data-jalalized])'
    )
    .forEach(input => {

      const iso = input.value || '';
      const name =
        input.getAttribute('name') || '';

      const id = input.id || '';
      const required = input.required;

      const next =
        input.nextElementSibling;

      if (
        next &&
        next.tagName === 'SMALL' &&
        next.textContent
          .trim()
          .startsWith('جلالی:')
      ) {
        next.remove();
      }

      const hidden =
        document.createElement('input');

      hidden.type = 'hidden';
      hidden.value = iso;

      if (name) {
        hidden.name = name;
      }

      if (id) {
        hidden.id = id;
      }

      input.type = 'text';

      input.removeAttribute('name');
      input.removeAttribute('id');

      input.dataset.jalalized = '1';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';

      input.placeholder = '۱۴۰۵/۰۶/۰۸';

      input.value =
        iso
          ? dateFa(iso)
          : '';

      const sync = () => {

        const raw =
          input.value.trim();

        if (!raw) {

          hidden.value = '';

          input.setCustomValidity(
            required
              ? 'تاریخ الزامی است.'
              : ''
          );

          return;
        }

        const parsed =
          jalaliToIso(raw);

        if (parsed) {

          hidden.value = parsed;
          input.setCustomValidity('');

        } else {

          hidden.value = '';

          input.setCustomValidity(
            'تاریخ شمسی معتبر وارد کنید؛ مثال ۱۴۰۵/۰۶/۰۸'
          );
        }
      };

      input.addEventListener(
        'input',
        sync
      );

      input.addEventListener(
        'blur',
        () => {

          sync();

          if (hidden.value) {
            input.value =
              dateFa(hidden.value);
          }
        }
      );

      input.insertAdjacentElement(
        'afterend',
        hidden
      );
    });

  bindJalaliPickers(root);
}

export function closeJalaliPicker() {

  const old =
    document.getElementById(
      'jalaliPickerLayer'
    );

  if (old) {
    old.remove();
  }
}

export function openJalaliPicker(
  input,
  hidden
) {

  closeJalaliPicker();

  const today =
    todayIso();

  const base =
    isoToJalali(
      hidden.value || today
    ) ||
    isoToJalali(today);

  let viewYear = base.jy;
  let viewMonth = base.jm;

  const layer =
    document.createElement('div');

  layer.id =
    'jalaliPickerLayer';

  layer.className =
    'jalali-picker-layer';

  layer.innerHTML = `
    <div
      class="jalali-picker"
      role="dialog"
      aria-label="تقویم شمسی"
    >

      <div class="jalali-picker-head">

        <button
          type="button"
          class="ghost small"
          data-j-prev
        >
          ماه قبل
        </button>

        <strong data-j-title></strong>

        <button
          type="button"
          class="ghost small"
          data-j-next
        >
          ماه بعد
        </button>

      </div>

      <div class="jalali-picker-week">
        ${
          J_WEEK_DAYS
            .map(
              x => `<span>${x}</span>`
            )
            .join('')
        }
      </div>

      <div
        class="jalali-picker-days"
        data-j-days
      ></div>

      <div class="jalali-picker-actions">

        <button
          type="button"
          class="ghost small"
          data-j-clear
        >
          پاک کردن
        </button>

        <button
          type="button"
          class="ghost small"
          data-j-close
        >
          بستن
        </button>

        <button
          type="button"
          class="primary small"
          data-j-today
        >
          امروز
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(layer);

  const title =
    layer.querySelector(
      '[data-j-title]'
    );

  const daysBox =
    layer.querySelector(
      '[data-j-days]'
    );

  const renderCalendar = () => {

    const faYear =
      new Intl.NumberFormat(
        'fa-IR',
        {
          useGrouping: false
        }
      ).format(viewYear);

    title.textContent =
      `${
        J_MONTH_NAMES[
          viewMonth - 1
        ]
      } ${faYear}`;

    const firstIso =
      jalaliToIso(
        `${viewYear}/${viewMonth}/1`
      );

    if (!firstIso) {

      daysBox.innerHTML = '';
      return;
    }

    const firstDate =
      new Date(
        firstIso + 'T12:00:00'
      );

    // شنبه = 0
    const offset =
      (firstDate.getDay() + 1) % 7;

    const count =
      jalaliMonthDays(
        viewYear,
        viewMonth
      );

    let html = '';

    for (
      let i = 0;
      i < offset;
      i++
    ) {
      html +=
        '<span class="jalali-day-empty"></span>';
    }

    for (
      let day = 1;
      day <= count;
      day++
    ) {

      const iso =
        jalaliToIso(
          `${viewYear}/${viewMonth}/${day}`
        );

      const selected =
        iso &&
        iso === hidden.value;

      const isToday =
        iso === today;

      const faDay =
        new Intl.NumberFormat(
          'fa-IR',
          {
            useGrouping: false
          }
        ).format(day);

      html += `
        <button
          type="button"
          class="
            jalali-day
            ${selected ? 'selected' : ''}
            ${isToday ? 'today' : ''}
          "
          data-j-day="${day}"
        >
          ${faDay}
        </button>
      `;
    }

    daysBox.innerHTML = html;

    daysBox
      .querySelectorAll(
        '[data-j-day]'
      )
      .forEach(btn => {

        btn.onclick = () => {

          const day =
            Number(
              btn.dataset.jDay
            );

          const iso =
            jalaliToIso(
              `${viewYear}/${viewMonth}/${day}`
            );

          if (!iso) {
            return;
          }

          hidden.value = iso;
          input.value = dateFa(iso);

          input.setCustomValidity('');

          input.dispatchEvent(
            new Event(
              'input',
              {
                bubbles: true
              }
            )
          );

          closeJalaliPicker();
        };
      });
  };

  layer
    .querySelector(
      '[data-j-prev]'
    )
    .onclick = () => {

      viewMonth--;

      if (viewMonth < 1) {
        viewMonth = 12;
        viewYear--;
      }

      renderCalendar();
    };

  layer
    .querySelector(
      '[data-j-next]'
    )
    .onclick = () => {

      viewMonth++;

      if (viewMonth > 12) {
        viewMonth = 1;
        viewYear++;
      }

      renderCalendar();
    };

  layer
    .querySelector(
      '[data-j-today]'
    )
    .onclick = () => {

      hidden.value = today;
      input.value = dateFa(today);

      input.setCustomValidity('');

      input.dispatchEvent(
        new Event(
          'input',
          {
            bubbles: true
          }
        )
      );

      closeJalaliPicker();
    };

  layer
    .querySelector(
      '[data-j-clear]'
    )
    .onclick = () => {

      hidden.value = '';
      input.value = '';

      input.dispatchEvent(
        new Event(
          'input',
          {
            bubbles: true
          }
        )
      );

      closeJalaliPicker();
    };

  layer
    .querySelector(
      '[data-j-close]'
    )
    .onclick =
      closeJalaliPicker;

  layer.onclick = e => {

    if (e.target === layer) {
      closeJalaliPicker();
    }
  };

  renderCalendar();
}

export function bindJalaliPickers(
  root = document
) {

  root
    .querySelectorAll(
      'input[data-jalalized]:not([data-picker-bound])'
    )
    .forEach(input => {

      const hidden =
        input.nextElementSibling;

      if (
        !hidden ||
        hidden.type !== 'hidden'
      ) {
        return;
      }

      input.dataset.pickerBound = '1';

      const button =
        document.createElement('button');

      button.type = 'button';

      button.className =
        'jalali-picker-btn';

      button.textContent =
        '📅 انتخاب تاریخ';

      button.title =
        'انتخاب تاریخ از تقویم شمسی';

      button.onclick = e => {

        e.preventDefault();
        e.stopPropagation();

        openJalaliPicker(
          input,
          hidden
        );
      };

      input.insertAdjacentElement(
        'afterend',
        button
      );
    });
}
