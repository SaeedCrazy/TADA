'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Drawer, ErrorLine, Pager, Switch, faDate, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Conv { id: string; mode: string; locale: string; createdAt: string; updatedAt: string; messages: number; firstMessage: string | null; customer: boolean }
interface Msg { id: string; role: string; content: string; createdAt: string; data: { picks?: string[]; proposedCart?: unknown[]; mode?: string } | null }

export default function AssistantAdmin() {
  const { me } = useStaff();
  const [page, setPage] = useState(1);
  const list = useLoad<{ conversations: Conv[]; total: number; page: number; pageSize: number }>(`/api/staff/conversations?page=${page}`);
  const settings = useLoad<{ settings: Record<string, unknown>; integrations: { assistant: string } }>(me.role === 'OWNER' ? '/api/staff/settings' : null);
  const [openId, setOpenId] = useState<string | null>(null);
  const conv = useLoad<{ conversation: { messages: Msg[]; profile: unknown } }>(openId ? `/api/staff/conversations/${openId}` : null);
  const { error, run } = useAction();
  const enabled = settings.data ? settings.data.settings.assistantEnabled !== false : true;
  return (
    <>
      <div className="adm-top"><h1>دستیار تادا</h1></div>
      {me.role === 'OWNER' ? (
        <div className="panel">
          <h2>وضعیت</h2>
          <Switch checked={enabled} label={enabled ? 'دستیار برای مشتری‌ها روشن است' : 'دستیار خاموش است'} onChange={(v) => void run(async () => { await api('/api/staff/settings/assistantEnabled', { method: 'PUT', json: { value: v } }); await settings.reload(); })} />
          <p className="muted tiny" style={{ marginTop: 8 }}>
            حالت فعلی: {settings.data?.integrations.assistant === 'llm' ? 'گفت‌وگوی هوشمند با مدل زبانی (با ابزارهای منو)' : 'حالت هدایت‌شده (بدون سرویس بیرونی)'}.
            بازبینی ماهانه: پاسخ‌های نامناسب یا پیشنهادهای اشتباه را این‌جا پیدا کنید و ذائقه‌ی محصولات را در «منو» اصلاح کنید.
          </p>
        </div>
      ) : null}
      <ErrorLine error={error ?? list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>شروع</th><th>اولین پیام</th><th>پیام‌ها</th><th>حالت</th><th>مشتری</th></tr></thead>
          <tbody>
            {list.data?.conversations.map((c) => (
              <tr key={c.id} className="click" onClick={() => setOpenId(c.id)}>
                <td className="tiny">{faDate(c.createdAt)}</td>
                <td>{c.firstMessage ?? '—'}</td>
                <td className="num">{c.messages.toLocaleString('fa-IR')}</td>
                <td><span className="badge">{c.mode === 'llm' ? 'هوشمند' : 'هدایت‌شده'}</span></td>
                <td>{c.customer ? 'عضو' : 'مهمان'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
      <Drawer open={Boolean(openId)} onClose={() => setOpenId(null)} title="گفت‌وگو">
        <div className="chat">
          {conv.data?.conversation.messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role === 'user' ? 'me' : 'bot'}`}>
              {m.content}
              {m.data?.proposedCart?.length ? <small style={{ display: 'block', opacity: 0.7 }}>سبد پیشنهادی: {m.data.proposedCart.length.toLocaleString('fa-IR')} قلم</small> : null}
            </div>
          ))}
        </div>
      </Drawer>
    </>
  );
}
