'use strict';

const faDigits = s =>
  String(s ?? '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const pad2 = n => String(n).padStart(2, '0');

const jDiv = (a, b) => Math.trunc(a / b);
const jMod = (a, b) => a - Math.trunc(a / b) * b;

const J_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
  1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178
];

export function jalCal(jy, withoutLeap = false) {
  let gy = jy + 621;
  let leapJ = -14;
  let jp = J_BREAKS[0];
  let jm, jump = 0, leap, leapG, march, n;

  if (jy < jp || jy >= J_BREAKS[J_BREAKS.length - 1]) {
    throw new Error('JALALI_YEAR_RANGE');
  }

  for (let i = 1; i < J_BREAKS.length; i++) {
    jm = J_BREAKS[i];
    jump = jm - jp;

    if (jy < jm) break;

    leapJ +=
      jDiv(jump, 33) * 8 +
      jDiv(jMod(jump, 33), 4);

    jp = jm;
  }

  n = jy - jp;

  leapJ +=
    jDiv(n, 33) * 8 +
    jDiv(jMod(n, 33) + 3, 4);

  if (jMod(jump, 33) === 4 && jump - n === 4) {
    leapJ++;
  }

  leapG =
    jDiv(gy, 4) -
    jDiv((jDiv(gy, 100) + 1) * 3, 4) -
    150;

  march = 20 + leapJ - leapG;

  if (withoutLeap) {
    return { gy, march };
  }

  if (jump - n < 6) {
    n = n - jump + jDiv(jump + 4, 33) * 33;
  }

  leap = jMod(jMod(n + 1, 33) - 1, 4);

  if (leap === -1) {
    leap = 4;
  }

  return { leap, gy, march };
}

export function g2d(gy, gm, gd) {
  let d =
    jDiv(
      (gy + jDiv(gm - 8, 6) + 100100) * 1461,
      4
    ) +
    jDiv(
      153 * jMod(gm + 9, 12) + 2,
      5
    ) +
    gd -
    34840408;

  d =
    d -
    jDiv(
      jDiv(
        gy + 100100 + jDiv(gm - 8, 6),
        100
      ) * 3,
      4
    ) +
    752;

  return d;
}

export function d2g(jdn) {
  let j = 4 * jdn + 139361631;

  j =
    j +
    jDiv(
      jDiv(
        4 * jdn + 183187720,
        146097
      ) * 3,
      4
    ) * 4 -
    3908;

  const i =
    jDiv(jMod(j, 1461), 4) * 5 +
    308;

  const gd =
    jDiv(jMod(i, 153), 5) + 1;

  const gm =
    jMod(jDiv(i, 153), 12) + 1;

  const gy =
    jDiv(j, 1461) -
    100100 +
    jDiv(8 - gm, 6);

  return { gy, gm, gd };
}

export function j2d(jy, jm, jd) {
  const r = jalCal(jy, true);

  return (
    g2d(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    jDiv(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

export function d2j(jdn) {
  const g = d2g(jdn);

  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jd, jm;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + jDiv(k, 31);
      jd = jMod(k, 31) + 1;

      return { jy, jm, jd };
    }

    k -= 186;
  } else {
    jy -= 1;
    k += 179;

    if (r.leap === 1) {
      k += 1;
    }
  }

  jm = 7 + jDiv(k, 30);
  jd = jMod(k, 30) + 1;

  return { jy, jm, jd };
}

export function jalaliToIso(value) {
  const s =
    faDigits(value)
      .trim()
      .replace(/[.\-]/g, '/');

  const m =
    s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!m) {
    return null;
  }

  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);

  if (
    jm < 1 ||
    jm > 12 ||
    jd < 1 ||
    jd > 31
  ) {
    return null;
  }

  try {
    const g = d2g(j2d(jy, jm, jd));

    const back =
      d2j(g2d(g.gy, g.gm, g.gd));

    if (
      back.jy !== jy ||
      back.jm !== jm ||
      back.jd !== jd
    ) {
      return null;
    }

    return (
      `${g.gy}-` +
      `${pad2(g.gm)}-` +
      `${pad2(g.gd)}`
    );
  } catch {
    return null;
  }
}

export function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;

  try {
    return (
      j2d(jy + 1, 1, 1) -
      j2d(jy, 1, 1) === 366
        ? 30
        : 29
    );
  } catch {
    return 29;
  }
}

export function isoToJalali(iso) {
  const m =
    String(iso || '')
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) {
    return null;
  }

  try {
    return d2j(
      g2d(
        Number(m[1]),
        Number(m[2]),
        Number(m[3])
      )
    );
  } catch {
    return null;
  }
}
