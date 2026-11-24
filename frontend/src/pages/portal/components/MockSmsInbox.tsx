import { useEffect, useState } from 'react';
import { Badge, Card } from '@/components';
import { subscribeMockSms } from '@/services/mock/smsInbox';
import type { MockSms } from '@/services/mock/db';
import { formatPhone, formatTime } from '@/utils/format';

/**
 * Dev-only visibility of the SMS the real system would send (FR-A02).
 * The token lives ONLY in the mock SMS log — never in an API response,
 * never in page state. Renders nothing while the log is empty.
 */
export function MockSmsInbox() {
  const [log, setLog] = useState<MockSms[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeMockSms(setLog);
    return () => {
      unsubscribe();
    };
  }, []);

  if (log.length === 0) return null;

  return (
    <Card
      className="mt-4 border-dashed border-amber-300 bg-amber-50/60"
      title={
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-amber-900">Mock SMS inbox (development)</h2>
          <p className="mt-0.5 text-xs font-normal text-amber-800/90">
            In production these arrive by SMS; tokens are never returned by the API.
          </p>
        </div>
      }
    >
      <ul className="space-y-3">
        {log.map((sms) => (
          <li key={sms.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">{formatPhone(sms.phone)}</span>
              <Badge tone={sms.type === 'TOKEN' ? 'info' : 'success'}>{sms.type}</Badge>
              <span className="ml-auto text-xs text-slate-400">{formatTime(sms.createdAt)}</span>
            </div>
            <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-700">{sms.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
