import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Space, Spin, Switch, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  JQBED_CONFIG_FIELDS,
  JQBED_CONFIG_GROUPS,
  createJqbedConfigModalState,
  reduceJqbedConfigModalState,
  serializeJqbedConfigDraft,
  validateJqbedConfigDraft,
} from './jqbedAlgorithmConfig';
import './jqbedAlgorithmConfig.scss';

const statusPresentation = {
  waiting: { color: 'default', labelKey: 'jqbedAlgorithmConfig.pydWaiting' },
  ready: { color: 'success', labelKey: 'jqbedAlgorithmConfig.pydReady' },
  error: { color: 'error', labelKey: 'jqbedAlgorithmConfig.pydError' },
};

export const JQBED_CONFIG_REQUEST_TIMEOUT_MS = 10000;

export default function JqbedAlgorithmConfigModal({
  open,
  envelope,
  operationResult,
  algorithmStatus,
  connected,
  connectionEpoch,
  onRequest,
  onSave,
  onReset,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const [activeGroup, setActiveGroup] = useState('sos');
  const [modalState, dispatch] = useReducer(
    reduceJqbedConfigModalState,
    undefined,
    createJqbedConfigModalState,
  );
  const wasOpen = useRef(false);
  const envelopeAtOpen = useRef(envelope);
  const connectionEpochAtOpen = useRef(connectionEpoch);
  const wasConnected = useRef(connected);
  const {
    draft,
    loadRequestId,
    pending,
    displayResult,
    requestError,
  } = modalState;
  const saving = Boolean(pending);
  const requestInFlight = Boolean(loadRequestId || pending);
  const validation = draft
    ? validateJqbedConfigDraft(draft)
    : { valid: false, errors: {} };

  const requestCurrentConfig = useCallback(() => {
    const requestId = onRequest();
    if (requestId) {
      dispatch({ type: 'beginLoad', requestId });
    } else {
      dispatch({ type: 'requestFailure', action: 'load' });
    }
  }, [onRequest]);

  useEffect(() => {
    const opening = open && !wasOpen.current;
    const closing = !open && wasOpen.current;
    wasOpen.current = open;

    if (opening) {
      envelopeAtOpen.current = envelope;
      connectionEpochAtOpen.current = connectionEpoch;
      wasConnected.current = connected;
      setActiveGroup('sos');
      dispatch({ type: 'open' });
      if (connected) {
        requestCurrentConfig();
      } else {
        dispatch({ type: 'disconnect' });
      }
    } else if (closing) {
      dispatch({ type: 'close' });
    }
  }, [connected, connectionEpoch, envelope, open, requestCurrentConfig]);

  useEffect(() => {
    if (open && connected && connectionEpoch !== connectionEpochAtOpen.current) {
      connectionEpochAtOpen.current = connectionEpoch;
      requestCurrentConfig();
    }
  }, [connected, connectionEpoch, open, requestCurrentConfig]);

  useEffect(() => {
    if (open && wasConnected.current && !connected) {
      dispatch({ type: 'disconnect' });
    }
    wasConnected.current = connected;
  }, [connected, open]);

  useEffect(() => {
    if (open && envelope?.values && envelope !== envelopeAtOpen.current) {
      dispatch({ type: 'envelope', envelope });
    }
  }, [envelope, open]);

  useEffect(() => {
    if (!open || !operationResult) return;
    dispatch({ type: 'result', result: operationResult });
  }, [open, operationResult]);

  useEffect(() => {
    if (!open || !loadRequestId) return undefined;
    const timeout = setTimeout(() => dispatch({
      type: 'timeout', action: 'load', requestId: loadRequestId,
    }), JQBED_CONFIG_REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [loadRequestId, open]);

  useEffect(() => {
    if (!open || !pending) return undefined;
    const timeout = setTimeout(() => dispatch({
      type: 'timeout', action: pending.action, requestId: pending.requestId,
    }), JQBED_CONFIG_REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [open, pending]);

  const loading = draft === null && Boolean(loadRequestId);
  const status = statusPresentation[algorithmStatus?.state] || statusPresentation.waiting;
  const savedAt = envelope?.savedAt
    ? new Date(envelope.savedAt).toLocaleString(i18n.resolvedLanguage || i18n.language)
    : null;
  const activeFields = JQBED_CONFIG_FIELDS.filter((field) => field.group === activeGroup);

  const renderField = (field) => {
    const value = draft[field.key];
    const setValue = (nextValue) => dispatch({
      type: 'change',
      key: field.key,
      value: nextValue,
    });

    if (field.kind === 'switch') {
      return <Switch checked={Number(value) === 1} onChange={(checked) => setValue(checked ? 1 : 0)} />;
    }
    if (field.kind === 'pair' || field.kind === 'sittingPair') {
      return (
        <Space.Compact block>
          {[0, 1].map((index) => (
            <InputNumber
              key={index}
              value={value?.[index]}
              min={0}
              aria-label={t(field.pairElementLabelKeys[index])}
              placeholder={t(field.pairElementLabelKeys[index])}
              onChange={(number) => {
                const pair = Array.isArray(value) ? [...value] : [0, 0];
                pair[index] = number;
                setValue(pair);
              }}
            />
          ))}
        </Space.Compact>
      );
    }
    return (
      <InputNumber
        value={value}
        min={0}
        precision={field.kind === 'integer' ? 0 : undefined}
        onChange={setValue}
      />
    );
  };

  const handleSave = () => {
    if (!draft || !validation.valid || requestInFlight) return;
    const requestId = onSave(serializeJqbedConfigDraft(draft));
    if (requestId) {
      dispatch({ type: 'begin', action: 'save', requestId });
    } else {
      dispatch({ type: 'requestFailure', action: 'save' });
    }
  };

  const handleReset = () => {
    if (!draft || requestInFlight) return;
    Modal.confirm({
      title: t('jqbedAlgorithmConfig.restoreConfirmation'),
      okText: t('jqbedAlgorithmConfig.restore'),
      cancelText: t('jqbedAlgorithmConfig.cancel'),
      centered: true,
      onOk: () => {
        const requestId = onReset();
        if (requestId) {
          dispatch({ type: 'begin', action: 'reset', requestId });
        } else {
          dispatch({ type: 'requestFailure', action: 'reset' });
        }
      },
    });
  };

  const handleClose = () => {
    dispatch({ type: 'close' });
    onClose();
  };

  const resultMessage = displayResult
    ? t(displayResult.message || (displayResult.ok
      ? 'jqbedAlgorithmConfig.success'
      : 'jqbedAlgorithmConfig.backend.saveFailed'))
    : null;

  return (
    <Modal
      open={open}
      width={920}
      title={t('jqbedAlgorithmConfig.title')}
      className="jqbedAlgorithmConfig"
      footer={null}
      centered
      maskClosable={false}
      styles={{ mask: { backgroundColor: 'rgba(5, 5, 18, 0.58)' } }}
      onCancel={handleClose}
    >
      <div className="jqbedAlgorithmConfig__summary">
        <Tag color={status.color}>{t(status.labelKey)}</Tag>
        <span>
          {savedAt
            ? t('jqbedAlgorithmConfig.lastSavedAt', { time: savedAt })
            : t('jqbedAlgorithmConfig.neverSaved')}
        </span>
      </div>

      {algorithmStatus?.error ? (
        <Alert type="error" showIcon message={algorithmStatus.error} />
      ) : null}
      {displayResult ? (
        <Alert type={displayResult.ok ? 'success' : 'error'} showIcon message={resultMessage} />
      ) : null}
      {requestError ? (
        <Alert type="error" showIcon message={t(requestError.message)} />
      ) : null}

      <div className="jqbedAlgorithmConfig__groups" role="tablist">
        {JQBED_CONFIG_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            role="tab"
            aria-selected={activeGroup === group.key}
            className={activeGroup === group.key ? 'is-active' : ''}
            onClick={() => setActiveGroup(group.key)}
          >
            {t(group.labelKey)}
          </button>
        ))}
      </div>

      <div className="jqbedAlgorithmConfig__formScroll">
        {loading ? (
          <div className="jqbedAlgorithmConfig__loading">
            <Spin />
          </div>
        ) : draft === null ? (
          <div className="jqbedAlgorithmConfig__loading">
            <Button disabled={!connected} onClick={requestCurrentConfig}>
              {t('jqbedAlgorithmConfig.retry')}
            </Button>
          </div>
        ) : activeFields.map((field) => (
          <div className="jqbedAlgorithmConfig__field" key={field.key}>
            <div className="jqbedAlgorithmConfig__fieldCopy">
              <label>{t(field.labelKey)}</label>
              <span>{t(field.helpKey)}</span>
              {validation.errors[field.key] ? (
                <span className="jqbedAlgorithmConfig__error">
                  {t(validation.errors[field.key])}
                </span>
              ) : null}
            </div>
            <div className="jqbedAlgorithmConfig__control">
              {renderField(field)}
            </div>
          </div>
        ))}
      </div>

      <div className="jqbedAlgorithmConfig__footer">
        <Button disabled={!draft || requestInFlight} onClick={handleReset}>
          {t('jqbedAlgorithmConfig.restore')}
        </Button>
        <Button onClick={handleClose}>{t('jqbedAlgorithmConfig.cancel')}</Button>
        <Button
          type="primary"
          disabled={loading || !validation.valid || requestInFlight}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? t('jqbedAlgorithmConfig.saving') : t('jqbedAlgorithmConfig.saveAndApply')}
        </Button>
      </div>
    </Modal>
  );
}
