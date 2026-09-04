'use strict';

const bi = value => {
  try {
    return BigInt(
      String(value ?? '0')
        .replace(/[٬,\s]/g, '')
    );
  } catch {
    return 0n;
  }
};

function daysPastDue(
  dueDate,
  asOf
) {
  if (
    !dueDate ||
    !asOf ||
    dueDate >= asOf
  ) {
    return 0;
  }

  const a =
    new Date(
      `${dueDate}T12:00:00Z`
    );

  const b =
    new Date(
      `${asOf}T12:00:00Z`
    );

  if (
    Number.isNaN(a.valueOf()) ||
    Number.isNaN(b.valueOf())
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (b - a) /
      86400000
    )
  );
}

function priorityLevel(score) {
  if (score >= 65) {
    return 'high';
  }

  if (score >= 35) {
    return 'medium';
  }

  return 'low';
}

function collectionAction({
  level,
  maxDays
}) {
  if (
    level === 'high' ||
    maxDays > 90
  ) {
    return {
      title:
        'پیگیری امروز',

      suggestion:
        'تماس مستقیم و تعیین تاریخ پرداخت؛ در صورت نیاز پیگیری رسمی با تأیید کاربر.'
    };
  }

  if (level === 'medium') {
    return {
      title:
        'یادآوری ظرف ۲۴ ساعت',

      suggestion:
        'یادآوری مودبانه، تأیید مانده و درخواست تاریخ دقیق پرداخت.'
    };
  }

  return {
    title:
      'پیگیری برنامه‌ریزی‌شده',

    suggestion:
      'یادآوری سبک و ثبت زمان پیگیری بعدی.'
  };
}

function buildCollection({
  aging,
  asOf
}) {
  const ar =
    aging?.receivables;

  if (!ar?.available) {
    return {
      available: false,
      total: 0n,
      overdue: 0n,
      priorities: []
    };
  }

  const total =
    bi(ar.total);

  const priorities =
    (ar.parties || [])
      .map(
        party => {
          const openItems =
            party.openItems || [];

          let overdue = 0n;
          let over90 = 0n;
          let maxDays = 0;

          for (
            const item of
            openItems
          ) {
            const days =
              daysPastDue(
                item.dueDate,
                asOf
              );

            maxDays =
              Math.max(
                maxDays,
                days
              );

            if (days > 0) {
              overdue +=
                bi(
                  item.remaining
                );
            }

            if (days > 90) {
              over90 +=
                bi(
                  item.remaining
                );
            }
          }

          const partyTotal =
            bi(party.total);

          const amountShare =
            total > 0n
              ? Number(
                  (
                    partyTotal *
                    10000n
                  ) /
                  total
                ) / 100
              : 0;

          const overdueShare =
            partyTotal > 0n
              ? Number(
                  (
                    overdue *
                    10000n
                  ) /
                  partyTotal
                ) / 100
              : 0;

          let score =
            Math.min(
              35,
              Math.round(
                amountShare *
                0.35
              )
            );

          score +=
            Math.min(
              30,
              Math.round(
                overdueShare *
                0.30
              )
            );

          if (maxDays > 90) {
            score += 25;
          } else if (
            maxDays > 60
          ) {
            score += 18;
          } else if (
            maxDays > 30
          ) {
            score += 12;
          } else if (
            maxDays > 0
          ) {
            score += 6;
          }

          if (
            over90 > 0n
          ) {
            score += 10;
          }

          score =
            Math.min(
              100,
              score
            );

          const level =
            priorityLevel(
              score
            );

          return {
            partyId:
              party.partyId,

            partyName:
              party.partyName,

            total:
              partyTotal,

            overdue,

            over90,

            maxDays,

            amountShare,

            overdueShare,

            score,

            level,

            action:
              collectionAction({
                level,
                maxDays
              })
          };
        }
      )
      .filter(
        item =>
          item.total > 0n
      )
      .sort(
        (a, b) =>
          a.score === b.score
            ? a.total === b.total
              ? 0
              : a.total > b.total
                ? -1
                : 1
            : b.score - a.score
      );

  return {
    available: true,

    total,

    overdue:
      priorities.reduce(
        (sum, item) =>
          sum +
          item.overdue,
        0n
      ),

    top3CashOpportunity:
      priorities
        .slice(0, 3)
        .reduce(
          (sum, item) =>
            sum +
            item.overdue,
          0n
        ),

    priorities:
      priorities.slice(
        0,
        8
      )
  };
}

function checklistItem({
  id,
  level,
  title,
  description,
  count = 0,
  page = null
}) {
  return {
    id,
    level,
    title,
    description,
    count,
    page
  };
}

function buildMonthEnd({
  asOf,
  entries,
  invoices,
  documents,
  periods,
  integrity,
  invoiceIntegrity
}) {
  const draftJournals =
    entries.filter(
      entry =>
        entry.status ===
          'draft'
    ).length;

  const draftInvoices =
    invoices.filter(
      invoice =>
        invoice.status ===
          'draft'
    ).length;

  const pendingDocuments =
    documents.filter(
      document =>
        [
          'uploaded',
          'extracted',
          'reviewed'
        ].includes(
          document.status
        )
    ).length;

  const reviewedUnlinked =
    documents.filter(
      document =>
        document.status ===
          'reviewed' &&
        !document
          .linked_journal_entry_id
    ).length;

  const unbalanced =
    Number(
      integrity
        ?.unbalanced_journals ||
      0
    );

  const orphanLines =
    Number(
      integrity
        ?.orphan_lines ||
      0
    );

  const postedInvoiceNoJournal =
    Number(
      invoiceIntegrity
        ?.posted_without_journal ||
      0
    );

  const invoiceMismatch =
    Number(
      invoiceIntegrity
        ?.total_mismatch ||
      0
    );

  const integrityProblems =
    unbalanced +
    orphanLines +
    postedInvoiceNoJournal +
    invoiceMismatch;

  const alreadyClosed =
    periods.some(
      period =>
        period.status ===
          'closed' &&
        period.date_from <=
          asOf &&
        period.date_to >=
          asOf
    );

  const items = [];

  if (
    integrityProblems > 0
  ) {
    items.push(
      checklistItem({
        id:
          'integrity',

        level:
          'blocked',

        title:
          'رفع خطاهای یکپارچگی',

        description:
          'قبل از بستن دوره، خطاهای Ledger/Invoice Integrity باید بررسی شوند.',

        count:
          integrityProblems,

        page:
          'settings'
      })
    );
  }

  if (
    draftJournals > 0
  ) {
    items.push(
      checklistItem({
        id:
          'draft_journals',

        level:
          'attention',

        title:
          'تکمیل پیش‌نویس اسناد',

        description:
          'سندهای حسابداری Draft باید تعیین تکلیف شوند.',

        count:
          draftJournals,

        page:
          'journal'
      })
    );
  }

  if (
    draftInvoices > 0
  ) {
    items.push(
      checklistItem({
        id:
          'draft_invoices',

        level:
          'attention',

        title:
          'تکمیل پیش‌نویس فاکتورها',

        description:
          'فاکتورهای Draft را ثبت قطعی یا حذف کنید.',

        count:
          draftInvoices,

        page:
          'invoices'
      })
    );
  }

  if (
    pendingDocuments > 0
  ) {
    items.push(
      checklistItem({
        id:
          'pending_documents',

        level:
          'attention',

        title:
          'تعیین تکلیف اسناد هوشمند',

        description:
          'اسناد Uploaded/Extracted/Reviewed هنوز چرخه حسابداری را کامل نکرده‌اند.',

        count:
          pendingDocuments,

        page:
          'documents'
      })
    );
  }

  if (
    reviewedUnlinked > 0
  ) {
    items.push(
      checklistItem({
        id:
          'reviewed_unlinked',

        level:
          'attention',

        title:
          'اتصال اسناد بازبینی‌شده به Ledger',

        description:
          'اسناد Reviewed وجود دارند که هنوز به سند حسابداری نهایی متصل نشده‌اند.',

        count:
          reviewedUnlinked,

        page:
          'documents'
      })
    );
  }

  if (!items.length) {
    items.push(
      checklistItem({
        id:
          'ready',

        level:
          'ready',

        title:
          'کنترل‌های پایه آماده‌اند',

        description:
          'در کنترل‌های 1.0، مانع شناخته‌شده‌ای برای بستن دوره دیده نشد.',

        count:
          0,

        page:
          'settings'
      })
    );
  }

  let readiness =
    100;

  readiness -=
    integrityProblems *
    30;

  readiness -=
    draftJournals *
    6;

  readiness -=
    draftInvoices *
    5;

  readiness -=
    pendingDocuments *
    3;

  readiness =
    Math.max(
      0,
      Math.min(
        100,
        readiness
      )
    );

  const status =
    integrityProblems > 0
      ? 'blocked'
      : (
          draftJournals +
          draftInvoices +
          pendingDocuments >
          0
        )
        ? 'attention'
        : 'ready';

  return {
    asOf,

    alreadyClosed,

    readiness,

    status,

    items,

    counts: {
      draftJournals,
      draftInvoices,
      pendingDocuments,
      reviewedUnlinked,
      integrityProblems
    }
  };
}

export function
buildCollectionCloseSnapshot({
  asOf,
  aging = null,
  entries = [],
  invoices = [],
  documents = [],
  periods = [],
  integrity = null,
  invoiceIntegrity = null
} = {}) {
  if (!asOf) {
    throw new Error(
      'COLLECTION_CLOSE_AS_OF_REQUIRED'
    );
  }

  return {
    asOf,

    collection:
      buildCollection({
        aging,
        asOf
      }),

    monthEnd:
      buildMonthEnd({
        asOf,
        entries,
        invoices,
        documents,
        periods,
        integrity,
        invoiceIntegrity
      })
  };
}
