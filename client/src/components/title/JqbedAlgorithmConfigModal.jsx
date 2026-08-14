import React, { useEffect, useReducer, useRef, useState } from 'react';
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

export default function JqbedAlgorithmConfigModal({
  open,
  envelope,
  operationResult,
  algorithmStatus,
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
  const envelopeAtOpen = useRef(envelope);
  const { draft, pending, displayResult } = modalState;
  const saving = Boolean(pending);
  const validation = draft
    ? validateJqbedConfigDraft(draft)
    : { valid: false, errors: {} };

  useEffect(() => {
    if (open) {
      envelopeAtOpen.current = envelope;
      setActiveGroup('sos');
      dispatch({ type: 'open' });
      onRequest();
    } else {
      dispatch({ type: 'close' });
    }
  }, [open, onRequest]);

  useEffect(() => {
    if (open && envelope?.values && envelope !== envelopeAtOpen.current) {
      dispatch({ type: 'envelope', envelope });
    }
  }, [envelope, open]);

  useEffect(() => {
    if (!open || !operationResult) return;
    dispatch({ type: 'result', result: operationResult });
  }, [open, operationResult]);

  const loading = draft === null;
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
    if (!draft || !validation.valid || saving) return;
    const requestId = onSave(serializeJqbedConfigDraft(draft));
    if (requestId) dispatch({ type: 'begin', action: 'save', requestId });
  };

  const handleReset = () => {
    Modal.confirm({
      title: t('jqbedAlgorithmConfig.restoreConfirmation'),
      okText: t('jqbedAlgorithmConfig.restore'),
      cancelText: t('jqbedAlgorithmConfig.cancel'),
      centered: true,
      onOk: () => {
        const requestId = onReset();
        if (requestId) dispatch({ type: 'begin', action: 'reset', requestId });
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
        <Button disabled={loading || saving} onClick={handleReset}>
          {t('jqbedAlgorithmConfig.restore')}
        </Button>
        <Button onClick={handleClose}>{t('jqbedAlgorithmConfig.cancel')}</Button>
        <Button
          type="primary"
          disabled={loading || !validation.valid || saving}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? t('jqbedAlgorithmConfig.saving') : t('jqbedAlgorithmConfig.saveAndApply')}
        </Button>
      </div>
    </Modal>
  );
}
