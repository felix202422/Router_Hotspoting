import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  useToast,
} from '@/components';
import {
  createPackage,
  listAdminPackages,
  setPackageStatus,
  updatePackage,
} from '@/services/api';
import type { Package, PackageInput } from '@/types';
import { ApiError } from '@/types';
import {
  formatBytes,
  formatDuration,
  formatSpeed,
  formatTzsFull,
} from '@/utils/format';

type DurationUnit = 'minutes' | 'hours' | 'days';

const UNIT_SECONDS: Record<DurationUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

interface Draft {
  name: string;
  description: string;
  priceTzs: string;
  durationValue: string;
  durationUnit: DurationUnit;
  unlimitedData: boolean;
  dataMb: string;
  downloadMbps: string;
  uploadMbps: string;
  deviceLimit: string;
  sortOrder: string;
}

interface DraftErrors {
  name?: string;
  priceTzs?: string;
  duration?: string;
  deviceLimit?: string;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  priceTzs: '',
  durationValue: '1',
  durationUnit: 'hours',
  unlimitedData: true,
  dataMb: '',
  downloadMbps: '',
  uploadMbps: '',
  deviceLimit: '1',
  sortOrder: '0',
};

/** Stored seconds → form value + unit (24h → 1 day, 90min → 90 minutes). */
function secondsToDuration(seconds: number): { value: string; unit: DurationUnit } {
  if (seconds > 0 && seconds % 86400 === 0) return { value: String(seconds / 86400), unit: 'days' };
  if (seconds > 0 && seconds % 3600 === 0) return { value: String(seconds / 3600), unit: 'hours' };
  return { value: String(Math.max(1, Math.round(seconds / 60))), unit: 'minutes' };
}

function draftFrom(pkg: Package): Draft {
  const { value, unit } = secondsToDuration(pkg.durationSeconds);
  return {
    name: pkg.name,
    description: pkg.description,
    priceTzs: String(pkg.priceTzs),
    durationValue: value,
    durationUnit: unit,
    unlimitedData: pkg.dataAllowanceBytes === null,
    dataMb:
      pkg.dataAllowanceBytes === null
        ? ''
        : String(Math.max(1, Math.round(pkg.dataAllowanceBytes / (1024 * 1024)))),
    downloadMbps: pkg.maxDownloadKbps === null ? '' : String(pkg.maxDownloadKbps / 1000),
    uploadMbps: pkg.maxUploadKbps === null ? '' : String(pkg.maxUploadKbps / 1000),
    deviceLimit: String(pkg.deviceLimit),
    sortOrder: String(pkg.sortOrder),
  };
}

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}

export function PackagesPage() {
  const toast = useToast();

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAdminPackages()
      .then((items) => {
        if (!cancelled) {
          setPackages(items);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPackages([]);
          setError(apiDetail(e, 'Could not load packages.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  /* ---------------- status toggle ---------------- */
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmPkg, setConfirmPkg] = useState<Package | null>(null);

  async function runToggle(pkg: Package) {
    const next: Package['status'] = pkg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setBusyId(pkg.id);
    try {
      await setPackageStatus(pkg.id, next);
      toast.success(
        next === 'ACTIVE' ? `Package "${pkg.name}" activated` : `Package "${pkg.name}" deactivated`,
      );
      setConfirmPkg(null);
      setTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not update the package status.'));
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- editor drawer ---------------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSubmitError(null);
    setDrawerOpen(true);
  }

  function openEdit(pkg: Package) {
    setEditing(pkg);
    setDraft(draftFrom(pkg));
    setErrors({});
    setSubmitError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSubmitError(null);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    const nextErrors: DraftErrors = {};
    const name = draft.name.trim();
    const price = Number(draft.priceTzs);
    const durationValue = Number(draft.durationValue);
    const durationSeconds = Number.isFinite(durationValue)
      ? Math.round(durationValue * UNIT_SECONDS[draft.durationUnit])
      : 0;
    const deviceLimit = Number(draft.deviceLimit);

    if (!name) nextErrors.name = 'Name is required.';
    if (!Number.isFinite(price) || price <= 0) nextErrors.priceTzs = 'Price must be greater than 0.';
    if (!Number.isFinite(durationValue) || durationValue <= 0 || durationSeconds <= 0) {
      nextErrors.duration = 'Duration must be greater than 0.';
    }
    if (!Number.isInteger(deviceLimit) || deviceLimit < 1) {
      nextErrors.deviceLimit = 'Device limit must be at least 1.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const dataMb = Number(draft.dataMb);
    const down = draft.downloadMbps.trim() === '' ? null : Number(draft.downloadMbps);
    const up = draft.uploadMbps.trim() === '' ? null : Number(draft.uploadMbps);
    const sortOrder = Number(draft.sortOrder);

    const input: PackageInput = {
      name,
      description: draft.description.trim(),
      priceTzs: Math.round(price),
      durationSeconds,
      dataAllowanceBytes:
        draft.unlimitedData || !Number.isFinite(dataMb) || dataMb <= 0
          ? null
          : Math.round(dataMb * 1024 * 1024),
      maxDownloadKbps:
        down !== null && Number.isFinite(down) && down > 0 ? Math.round(down * 1000) : null,
      maxUploadKbps: up !== null && Number.isFinite(up) && up > 0 ? Math.round(up * 1000) : null,
      deviceLimit,
      status: editing?.status ?? 'ACTIVE',
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    };

    setSaving(true);
    setSubmitError(null);
    try {
      if (editing) {
        await updatePackage(editing.id, input);
        toast.success('Package updated');
      } else {
        await createPackage(input);
        toast.success('Package created');
      }
      closeDrawer();
      setTick((t) => t + 1);
    } catch (e: unknown) {
      setSubmitError(apiDetail(e, 'Could not save the package.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Packages"
        subtitle="What customers can buy — price, duration, limits and speed."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            New package
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load packages"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
              Retry
            </Button>
          }
        />
      ) : packages.length === 0 ? (
        <EmptyState
          title="No packages yet"
          description="Create your first package so customers can buy Wi-Fi access."
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
              New package
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900">{pkg.name}</h2>
                <StatusBadge status={pkg.status} />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                {formatTzsFull(pkg.priceTzs)}
              </p>
              {pkg.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{pkg.description}</p>
              )}
              <dl className="mt-3 space-y-1.5 text-sm">
                <InfoRow label="Duration" value={formatDuration(pkg.durationSeconds)} />
                <InfoRow label="Download" value={formatSpeed(pkg.maxDownloadKbps)} />
                <InfoRow label="Upload" value={formatSpeed(pkg.maxUploadKbps)} />
                <InfoRow
                  label="Data"
                  value={pkg.dataAllowanceBytes === null ? 'Unlimited' : formatBytes(pkg.dataAllowanceBytes)}
                />
                <InfoRow label="Devices" value={String(pkg.deviceLimit)} />
                <InfoRow label="Active subscribers" value={(pkg.activeSubscriberCount ?? 0).toLocaleString()} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(pkg)}>
                  Edit
                </Button>
                <Button
                  variant={pkg.status === 'ACTIVE' ? 'secondary' : 'success'}
                  size="sm"
                  loading={busyId === pkg.id}
                  onClick={() =>
                    pkg.status === 'ACTIVE' ? setConfirmPkg(pkg) : runToggle(pkg)
                  }
                >
                  {pkg.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Package editor */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? `Edit "${editing.name}"` : 'New package'}
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={submit}>
              {editing ? 'Save changes' : 'Create package'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
            >
              {submitError}
            </p>
          )}

          <Field label="Name" htmlFor="pkg-name" required error={errors.name}>
            <Input
              id="pkg-name"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              error={!!errors.name}
              placeholder="e.g. 24 Hours"
            />
          </Field>

          <Field label="Description" htmlFor="pkg-description">
            <Textarea
              id="pkg-description"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short line shown to customers"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Price (TZS)" htmlFor="pkg-price" required error={errors.priceTzs}>
              <Input
                id="pkg-price"
                type="number"
                min={1}
                step={100}
                value={draft.priceTzs}
                onChange={(e) => set('priceTzs', e.target.value)}
                error={!!errors.priceTzs}
                placeholder="2000"
              />
            </Field>
            <Field label="Device limit" htmlFor="pkg-devices" required error={errors.deviceLimit}>
              <Input
                id="pkg-devices"
                type="number"
                min={1}
                step={1}
                value={draft.deviceLimit}
                onChange={(e) => set('deviceLimit', e.target.value)}
                error={!!errors.deviceLimit}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duration" htmlFor="pkg-duration" required error={errors.duration}>
              <Input
                id="pkg-duration"
                type="number"
                min={1}
                step={1}
                value={draft.durationValue}
                onChange={(e) => set('durationValue', e.target.value)}
                error={!!errors.duration}
              />
            </Field>
            <Field label="Unit" htmlFor="pkg-unit">
              <Select
                id="pkg-unit"
                value={draft.durationUnit}
                onChange={(e) => set('durationUnit', e.target.value as DurationUnit)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="pkg-unlimited"
              className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"
            >
              <input
                id="pkg-unlimited"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-leaf-600"
                checked={draft.unlimitedData}
                onChange={(e) => set('unlimitedData', e.target.checked)}
              />
              Unlimited data
            </label>
            {!draft.unlimitedData && (
              <Field
                label="Data allowance (MB)"
                htmlFor="pkg-data"
                hint="Total download + upload allowance."
              >
                <Input
                  id="pkg-data"
                  type="number"
                  min={1}
                  value={draft.dataMb}
                  onChange={(e) => set('dataMb', e.target.value)}
                  placeholder="1024"
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Download speed (Mbps)" htmlFor="pkg-down" hint="Empty = unlimited.">
              <Input
                id="pkg-down"
                type="number"
                min={0}
                step={0.1}
                value={draft.downloadMbps}
                onChange={(e) => set('downloadMbps', e.target.value)}
                placeholder="10"
              />
            </Field>
            <Field label="Upload speed (Mbps)" htmlFor="pkg-up" hint="Empty = unlimited.">
              <Input
                id="pkg-up"
                type="number"
                min={0}
                step={0.1}
                value={draft.uploadMbps}
                onChange={(e) => set('uploadMbps', e.target.value)}
                placeholder="5"
              />
            </Field>
          </div>

          <Field label="Sort order" htmlFor="pkg-sort" hint="Lower numbers are listed first.">
            <Input
              id="pkg-sort"
              type="number"
              step={1}
              value={draft.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </Field>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmPkg !== null}
        title="Deactivate package"
        message={`Deactivate "${confirmPkg?.name ?? ''}"? It disappears from the purchase flow. Existing subscriptions keep their remaining time.`}
        confirmLabel="Deactivate"
        danger
        loading={busyId !== null && confirmPkg !== null && busyId === confirmPkg.id}
        onConfirm={() => {
          if (confirmPkg) void runToggle(confirmPkg);
        }}
        onCancel={() => setConfirmPkg(null)}
      />
    </div>
  );
}
