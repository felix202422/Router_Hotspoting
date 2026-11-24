import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Smartphone, XCircle } from 'lucide-react';
import { Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Stepper } from '@/components';
import { createPurchase, getPurchase, listPackages } from '@/services/api';
import type { Package, PaymentStatus, PurchaseInitResponse } from '@/types';
import { ApiError } from '@/types';
import { cn } from '@/utils/cn';
import { formatBytes, formatDuration, formatPhone, formatSpeed, formatTzs } from '@/utils/format';
import { MockSmsInbox } from './components/MockSmsInbox';

const STEPS = ['Package', 'Phone', 'Pay'];
const PHONE_RE = /^\+255\d{9}$/;
const POLL_INTERVAL_MS = 2500;

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

export function PurchasePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(0);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [purchase, setPurchase] = useState<PurchaseInitResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const selected = packages.find((p) => p.id === selectedId) ?? null;

  const loadPackages = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listPackages()
      .then((items) => setPackages(items))
      .catch((e: unknown) => {
        setPackages([]);
        setLoadError(apiDetail(e, 'Could not load packages. Please try again.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  /* ?package=<id> preselection (once packages arrive) */
  useEffect(() => {
    if (loading || selectedId !== null) return;
    const raw = searchParams.get('package');
    if (!raw) return;
    const id = Number(raw);
    if (Number.isInteger(id) && packages.some((p) => p.id === id)) setSelectedId(id);
  }, [loading, packages, selectedId, searchParams]);

  /* Step 2: poll the purchase until it reaches a terminal status (§1.2 / P3). */
  useEffect(() => {
    if (step !== 2 || !purchase || paymentStatus !== 'PENDING') return;
    const purchaseId = purchase.purchaseId;
    let active = true;
    const intervalId = window.setInterval(() => {
      getPurchase(purchaseId)
        .then((res) => {
          if (!active) return;
          if (res.status === 'SUCCESS' || res.status === 'FAILED') {
            window.clearInterval(intervalId);
            setPaymentStatus(res.status);
            setFailureReason(res.failureReason);
          }
        })
        .catch(() => {
          /* transient poll error — keep polling */
        });
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [step, purchase, paymentStatus]);

  async function proceedToPayment(): Promise<void> {
    if (!selected) return;
    const normalized = phone.replace(/[\s-]/g, '');
    if (!PHONE_RE.test(normalized)) {
      setPhoneError('Enter a valid Tanzanian mobile number, e.g. +255 712 345 678');
      return;
    }
    setPhoneError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await createPurchase({ phone: normalized, packageId: selected.id });
      setPurchase(res);
      setPaymentStatus(res.status);
      setFailureReason(null);
      setStep(2);
    } catch (e) {
      setSubmitError(apiDetail(e, 'Could not start the M-Pesa payment. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  function restart(): void {
    setPurchase(null);
    setPaymentStatus(null);
    setFailureReason(null);
    setSubmitError(null);
    setPhoneError(null);
    setStep(0);
  }

  /* Never show phone/pay steps without a package. */
  const currentStep = step > 0 && !selected ? 0 : step;

  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader title="Buy a package" subtitle="Pay with M-Pesa — your access token arrives by SMS." />
      <div className="mb-5">
        <Stepper steps={STEPS} current={currentStep} />
      </div>

      {/* ---------------- Step 1: Package ---------------- */}
      {currentStep === 0 && (
        <Card title="Choose a package">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}

          {!loading && loadError && (
            <div className="py-6 text-center">
              <p role="alert" className="text-sm text-red-600">
                {loadError}
              </p>
              <Button variant="outline" className="mt-3" onClick={loadPackages}>
                Try again
              </Button>
            </div>
          )}

          {!loading && !loadError && packages.length === 0 && (
            <EmptyState
              title="No packages available"
              description="Packages will show up here as soon as they are configured."
            />
          )}

          {!loading && !loadError && packages.length > 0 && (
            <>
              <ul className="space-y-3">
                {packages.map((pkg) => {
                  const isSelected = pkg.id === selectedId;
                  return (
                    <li key={pkg.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(pkg.id)}
                        className={cn(
                          'w-full rounded-xl border p-4 text-left transition',
                          isSelected
                            ? 'border-electric-600 bg-electric-50 ring-1 ring-electric-600'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatDuration(pkg.durationSeconds)} · {formatSpeed(pkg.maxDownloadKbps)} down
                            </p>
                            <p className="text-xs text-slate-500">
                              {pkg.dataAllowanceBytes === null
                                ? 'Unlimited data'
                                : `${formatBytes(pkg.dataAllowanceBytes)} data`}
                            </p>
                            {pkg.description && (
                              <p className="mt-1 text-xs leading-relaxed text-slate-500">{pkg.description}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm font-bold text-slate-900">
                            TZS {formatTzs(pkg.priceTzs)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <Button
                size="lg"
                block
                className="mt-4"
                disabled={!selected}
                onClick={() => setStep(1)}
              >
                Continue
              </Button>
            </>
          )}
        </Card>
      )}

      {/* ---------------- Step 2: Phone ---------------- */}
      {currentStep === 1 && selected && (
        <>
          <Card title="Your mobile number">
            <Field
              label="Mobile number"
              htmlFor="purchase-phone"
              error={phoneError}
              hint="We send your access token by SMS to this number."
              required
            >
              <Input
                id="purchase-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+255 712 345 678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                error={!!phoneError}
                inputSize="lg"
              />
            </Field>
          </Card>

          <Card title="Order summary" className="mt-4">
            <dl className="text-sm">
              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-slate-500">Package</dt>
                <dd className="text-right font-medium text-slate-900">{selected.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-right font-medium text-slate-900">
                  {formatDuration(selected.durationSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
                <dt className="font-semibold text-slate-700">Total</dt>
                <dd className="text-right text-base font-bold text-slate-900">
                  TZS {formatTzs(selected.priceTzs)}
                </dd>
              </div>
            </dl>
          </Card>

          {submitError && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
            >
              {submitError}
            </p>
          )}

          <div className="mt-4 space-y-3">
            <Button
              size="lg"
              block
              loading={submitting}
              onClick={() => void proceedToPayment()}
              icon={<Smartphone size={18} aria-hidden />}
            >
              Proceed to M-Pesa payment
            </Button>
            <Button variant="outline" block disabled={submitting} onClick={() => setStep(0)}>
              Back
            </Button>
          </div>
        </>
      )}

      {/* ---------------- Step 3: Pay ---------------- */}
      {currentStep === 2 && purchase && (
        <>
          {paymentStatus === 'SUCCESS' && (
            <>
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 size={26} aria-hidden />
                </span>
                <h2 className="mt-3 text-lg font-semibold text-green-900">Payment confirmed!</h2>
                <p className="mt-1 text-sm leading-relaxed text-green-800">
                  Your access token has been sent by SMS to {formatPhone(purchase.phone)}.
                </p>
                <p className="mt-1 text-sm text-green-700">Connection will start automatically.</p>
              </div>

              <MockSmsInbox />

              <div className="mt-4 space-y-3">
                <Button size="lg" block variant="success" onClick={() => navigate('/connect')}>
                  View my subscription
                </Button>
                <Button size="lg" block variant="outline" onClick={() => navigate('/')}>
                  Back to home
                </Button>
              </div>
            </>
          )}

          {paymentStatus === 'FAILED' && (
            <>
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <XCircle size={26} aria-hidden />
                </span>
                <h2 className="mt-3 text-lg font-semibold text-red-900">Payment failed</h2>
                <p className="mt-1 text-sm leading-relaxed text-red-800">
                  {failureReason ?? 'The M-Pesa payment could not be completed.'}
                </p>
              </div>

              <Button size="lg" block className="mt-4" onClick={restart}>
                Try again
              </Button>
            </>
          )}

          {(paymentStatus === null || paymentStatus === 'PENDING' || paymentStatus === 'REFUNDED') && (
            <Card>
              <div className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-electric-50 text-electric-600">
                  <Clock size={24} aria-hidden />
                </span>
                <h2 className="mt-3 text-lg font-semibold text-slate-900">Check your phone</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Approve the M-Pesa prompt sent to {formatPhone(purchase.phone)}.
                </p>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {purchase.package.name} · TZS {formatTzs(purchase.package.priceTzs)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{purchase.paymentInstructions}</p>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                <Spinner size="sm" />
                <span>Waiting for payment confirmation…</span>
              </div>

              <Button variant="outline" block className="mt-4" onClick={restart}>
                Cancel
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
