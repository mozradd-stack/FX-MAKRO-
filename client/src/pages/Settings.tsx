import { useEffect, useState, type ReactNode } from 'react';
import { fetchCentralBanks, updateAllCentralBanks } from '@/api/client';
import type { CentralBank } from '@/types';
import { useFredApiKey } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function SettingsPage() {
  const [fredKey, setFredKey] = useFredApiKey();
  const [fredDraft, setFredDraft] = useState(fredKey);
  const [banks, setBanks] = useState<CentralBank[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchCentralBanks().then(setBanks);
  }, []);

  function patchBank(id: string, patch: Partial<CentralBank>) {
    setBanks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function handleUpdateAll() {
    setSaving(true);
    const updated = await updateAllCentralBanks(banks);
    setBanks(updated);
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('de-DE'));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">API-Key und manuelle Datenpflege für alle Zentralbanken.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FRED API Key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[280px] space-y-1.5">
            <Label htmlFor="fred-key">St. Louis Fed FRED API Key</Label>
            <Input
              id="fred-key"
              type="password"
              placeholder="z.B. abcdef1234567890"
              value={fredDraft}
              onChange={(e) => setFredDraft(e.target.value)}
            />
          </div>
          <Button onClick={() => setFredKey(fredDraft)}>Key speichern</Button>
          {fredKey && <span className="text-xs text-success">Key gespeichert (localStorage)</span>}
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zentralbank Daten</h2>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-muted">Zuletzt gespeichert: {savedAt}</span>}
            <Button onClick={handleUpdateAll} disabled={saving}>
              {saving ? 'Speichere…' : 'Update All'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {banks.map((bank) => (
            <Card key={bank.id}>
              <CardHeader>
                <CardTitle className="text-foreground text-base font-semibold">
                  {bank.name} ({bank.currency})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Aktueller Leitzins (%)">
                  <Input
                    type="number"
                    step="0.05"
                    value={bank.current_rate}
                    onChange={(e) => patchBank(bank.id, { current_rate: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Letzte Änderung (Betrag)">
                  <Input
                    type="number"
                    step="0.05"
                    value={bank.last_change_amount}
                    onChange={(e) => patchBank(bank.id, { last_change_amount: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Letzte Änderung (Datum)">
                  <Input
                    type="date"
                    value={bank.last_change_date}
                    onChange={(e) => patchBank(bank.id, { last_change_date: e.target.value })}
                  />
                </Field>
                <Field label="Nächste Sitzung">
                  <Input
                    type="date"
                    value={bank.next_meeting}
                    onChange={(e) => patchBank(bank.id, { next_meeting: e.target.value })}
                  />
                </Field>
                <Field label="Forward Guidance">
                  <Select
                    value={bank.forward_guidance}
                    onChange={(e) => patchBank(bank.id, { forward_guidance: e.target.value as CentralBank['forward_guidance'] })}
                  >
                    <option value="hawkish">Hawkish</option>
                    <option value="neutral">Neutral</option>
                    <option value="dovish">Dovish</option>
                  </Select>
                </Field>
                <Field label="CPI aktuell (%)">
                  <Input
                    type="number"
                    step="0.1"
                    value={bank.cpi}
                    onChange={(e) => patchBank(bank.id, { cpi: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Unemployment aktuell (%)">
                  <Input
                    type="number"
                    step="0.1"
                    value={bank.unemployment}
                    onChange={(e) => patchBank(bank.id, { unemployment: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="GDP Growth (%)">
                  <Input
                    type="number"
                    step="0.1"
                    value={bank.gdp_growth}
                    onChange={(e) => patchBank(bank.id, { gdp_growth: parseFloat(e.target.value) || 0 })}
                  />
                </Field>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
