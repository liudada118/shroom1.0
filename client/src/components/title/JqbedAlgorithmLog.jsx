import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createJqbedLiveLogState,
  createJqbedLogSubscription,
  isJqbedLogMissing,
} from './jqbedAlgorithmLogState';
import { getJqbedLogFieldInfo } from './jqbedAlgorithmLogFields';

export const JqbedLogJson = memo(function JqbedLogJson({ label, value }) {
  const [expanded, setExpanded] = useState(false);
  const json = useMemo(() => expanded ? JSON.stringify(value, null, 2) : null, [expanded, value]);
  return (
    <details className="jqbedAlgorithmConfig__logJson" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>{label}</summary>
      {expanded ? <pre>{json}</pre> : null}
    </details>
  );
});

export const JqbedAlgorithmLogValues = memo(function JqbedAlgorithmLogValues({ frame }) {
  const { t, i18n } = useTranslation();
  const displayedValues = useMemo(() => Object.fromEntries(Object.entries(frame.outputs)
    .filter(([, value]) => !isJqbedLogMissing(value))), [frame.outputs]);
  const date = new Date(frame.receivedAt);
  const time = Number.isNaN(date.getTime()) ? frame.receivedAt
    : date.toLocaleString(i18n.resolvedLanguage || i18n.language, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, fractionalSecondDigits: 3,
    });
  return (
    <div className="jqbedAlgorithmConfig__logValues">
      <header className="jqbedAlgorithmConfig__logMeta">
        <span>{t('jqbedAlgorithmConfig.log.lastReceived')} <time dateTime={frame.receivedAt}>{time}</time></span>
        <span>#{frame.sequence}</span>
        <span>{t('jqbedAlgorithmConfig.log.fieldCount', { count: Object.keys(frame.outputs).length })}</span>
      </header>
      <dl className="jqbedAlgorithmConfig__logFields">
        {Object.entries(frame.outputs).map(([key, value]) => {
          const { label, description } = getJqbedLogFieldInfo(key, t);
          return (
            <div key={key}>
              <dt>
                <span className="jqbedAlgorithmConfig__logFieldName">{label}</span>
                <code className="jqbedAlgorithmConfig__logRawKey">{key}</code>
              </dt>
              <dd>
                <div>
                  {isJqbedLogMissing(value) ? (
                    <span className="jqbedAlgorithmConfig__logPending">{t('jqbedAlgorithmConfig.log.pendingValue')}</span>
                  ) : value !== null && typeof value === 'object' ? (
                    <JqbedLogJson
                      label={Array.isArray(value)
                        ? t('jqbedAlgorithmConfig.log.arrayValue', { count: value.length })
                        : t('jqbedAlgorithmConfig.log.objectValue')}
                      value={value}
                    />
                  ) : <code className="jqbedAlgorithmConfig__logFieldValue">{JSON.stringify(value) ?? String(value)}</code>}
                </div>
                <p className="jqbedAlgorithmConfig__logFieldDescription">{description}</p>
              </dd>
            </div>
          );
        })}
      </dl>
      <JqbedLogJson label={t('jqbedAlgorithmConfig.log.rawJson')} value={displayedValues} />
    </div>
  );
});

export default function JqbedAlgorithmLog({
  active,
  open,
  connected,
  connectionEpoch,
  algorithmLogFrame,
  logSubscription,
  onLogSubscription,
}) {
  const { t } = useTranslation();
  const [latestFrame, setLatestFrame] = useState(null);
  const [request, setRequest] = useState({ attempted: false, requestId: null });
  const liveStateRef = useRef(null);
  const subscriptionRef = useRef(null);
  if (!liveStateRef.current) liveStateRef.current = createJqbedLiveLogState(algorithmLogFrame);
  if (!subscriptionRef.current) subscriptionRef.current = createJqbedLogSubscription();
  const enabled = Boolean(active && open && connected);
  const matchingResult = logSubscription
    && (!logSubscription.requestId || logSubscription.requestId === request.requestId);
  const receiving = enabled && request.requestId && matchingResult
    && logSubscription.ok && logSubscription.subscribed;

  useEffect(() => {
    setLatestFrame(liveStateRef.current.reset(algorithmLogFrame));
    // A new tab/connection session must wait for a new native frame, not reuse an old prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, connected, connectionEpoch]);

  useEffect(() => {
    const subscription = subscriptionRef.current;
    setRequest(subscription.update({ enabled, connectionEpoch, subscribe: onLogSubscription }));
    return () => subscription.stop();
  }, [enabled, connectionEpoch, onLogSubscription]);

  useEffect(() => {
    setLatestFrame(liveStateRef.current.observe(algorithmLogFrame, Boolean(receiving)));
  }, [algorithmLogFrame, receiving]);

  if (!active || !open) return null;
  let statusKey = 'waiting';
  if (!connected) statusKey = 'disconnected';
  else if (request.attempted && !request.requestId) statusKey = 'sendFailed';
  else if (matchingResult && !logSubscription.ok) statusKey = 'denied';
  else if (receiving) statusKey = 'receiving';
  else if (matchingResult && logSubscription.ok && !logSubscription.subscribed) statusKey = 'stopped';
  return (
    <section className="jqbedAlgorithmConfig__logPanel" aria-label={t('jqbedAlgorithmConfig.log.title')}>
      <p className="jqbedAlgorithmConfig__logStatus">
        {t(`jqbedAlgorithmConfig.log.${statusKey}`)}
        {statusKey === 'denied' && logSubscription.message ? ` ${t(logSubscription.message)}` : null}
      </p>
      <p className="jqbedAlgorithmConfig__logHelp">{t('jqbedAlgorithmConfig.log.help')}</p>
      <div className="jqbedAlgorithmConfig__logList">
        {latestFrame === null ? <p className="jqbedAlgorithmConfig__logEmpty">{t('jqbedAlgorithmConfig.log.empty')}</p>
          : <JqbedAlgorithmLogValues frame={latestFrame} />}
      </div>
    </section>
  );
}
