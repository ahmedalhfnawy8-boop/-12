import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Loader2,
  Mic,
  Pause,
  Play,
  X,
} from 'lucide-react';
import {
  TOTAL_MUSHAF_PAGES,
  toArabicDigits,
  type MushafDataset,
  type MushafSurahMeta,
} from '../utils/mushafData';
import {
  AYAH_REPEAT_OPTIONS,
  PLAYBACK_RATE_OPTIONS,
  QURAN_RECITERS,
  compareAyahRefs,
  computeAyahRangeEnd,
  countAyahsBetween,
  findMushafPageForAyah,
  getJozzAyahSpan,
  getPageAyahSpan,
  type PlaybackRateOption,
  type ReciterId,
} from '../utils/quranAudio';

export interface AudioControlTarget {
  surahId: number;
  ayahNum: number;
}

export interface AudioControlApplyPayload {
  surahId: number;
  ayahNum: number;
  reciterId: ReciterId;
  rate: PlaybackRateOption;
  repeat: number;
  repeatSection: boolean;
  ayahCount: number;
  autoFollow: boolean;
}

type AudioScopeType = 'ayah' | 'page' | 'jozz' | 'surah';
type AudioRangeMode = 'range' | 'single';

interface AudioControlModalProps {
  target: AudioControlTarget | null;
  onClose: () => void;
  surahMetaMap: Map<number, MushafSurahMeta>;
  mushafDataset: MushafDataset | null;
  currentPageSurahId?: number;
  currentPageNum?: number;
  currentJozz?: number;
  reciterId: ReciterId;
  rate: PlaybackRateOption;
  repeat: number;
  repeatSection: boolean;
  ayahCount: number;
  autoFollow: boolean;
  activeAudioTarget: AudioControlTarget | null;
  isPlaying: boolean;
  isLoading: boolean;
  onStartPlayback: (payload: AudioControlApplyPayload) => void;
  onPausePlayback: () => void;
}

const NON_SINGLE_REPEAT_OPTIONS = AYAH_REPEAT_OPTIONS.filter((opt) => opt !== 1);

export const AudioControlModal: React.FC<AudioControlModalProps> = ({
  target,
  onClose,
  surahMetaMap,
  mushafDataset,
  currentPageSurahId,
  currentPageNum,
  currentJozz,
  reciterId,
  rate,
  repeat,
  repeatSection,
  ayahCount,
  autoFollow,
  activeAudioTarget,
  isPlaying,
  isLoading,
  onStartPlayback,
  onPausePlayback,
}) => {
  const modalCardRef = useRef<HTMLFormElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [draftReciterId, setDraftReciterId] = useState<ReciterId>(reciterId);
  const [scopeType, setScopeType] = useState<AudioScopeType>('ayah');
  const [rangeMode, setRangeMode] = useState<AudioRangeMode>('single');

  // Ayah scope state
  const [fromSurahId, setFromSurahId] = useState<number>(target?.surahId ?? 1);
  const [fromAyah, setFromAyah] = useState<number>(target?.ayahNum ?? 1);
  const [toSurahId, setToSurahId] = useState<number>(target?.surahId ?? 1);
  const [toAyah, setToAyah] = useState<number>(target?.ayahNum ?? 1);

  // Page scope state
  const [fromPage, setFromPage] = useState<number>(currentPageNum ?? 1);
  const [toPage, setToPage] = useState<number>(currentPageNum ?? 1);

  // Jozz scope state
  const [fromJozz, setFromJozz] = useState<number>(currentJozz ?? 1);
  const [toJozz, setToJozz] = useState<number>(currentJozz ?? 1);

  // Surah scope state
  const [fromRangeSurahId, setFromRangeSurahId] = useState<number>(target?.surahId ?? 1);
  const [toRangeSurahId, setToRangeSurahId] = useState<number>(target?.surahId ?? 1);

  // Repeat, speed, and options
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(repeat !== 1);
  const [repeatValue, setRepeatValue] = useState<number>(repeat !== 1 ? repeat : 2);
  const [repeatSectionDraft, setRepeatSectionDraft] = useState<boolean>(repeatSection);
  const [draftRate, setDraftRate] = useState<PlaybackRateOption>(rate);
  const [autoFollowDraft, setAutoFollowDraft] = useState<boolean>(autoFollow);

  const orderedSurahs = useMemo(
    () => Array.from(surahMetaMap.values()).sort((a, b) => a.id - b.id),
    [surahMetaMap]
  );

  const pageNumbers = useMemo(
    () => Array.from({ length: TOTAL_MUSHAF_PAGES }, (_, i) => i + 1),
    []
  );

  const jozzNumbers = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);

  useEffect(() => {
    if (!target) return;
    const meta = surahMetaMap.get(target.surahId);
    const total = meta?.totalAyat ?? 7;
    const clampedFromAyah = Math.max(1, Math.min(total, target.ayahNum));
    const endInfo =
      ayahCount > 1
        ? computeAyahRangeEnd(target.surahId, clampedFromAyah, ayahCount, surahMetaMap)
        : { end: { surahId: target.surahId, ayahNum: clampedFromAyah }, actualCount: 1 };

    const targetPage =
      findMushafPageForAyah(mushafDataset, target.surahId, clampedFromAyah) ??
      currentPageNum ??
      1;
    const targetJozz = mushafDataset?.pages[targetPage - 1]?.j ?? currentJozz ?? 1;

    setDraftReciterId(reciterId);
    setScopeType('ayah');
    setRangeMode(ayahCount > 1 ? 'range' : 'single');

    setFromSurahId(target.surahId);
    setFromAyah(clampedFromAyah);
    setToSurahId(endInfo.end.surahId);
    setToAyah(endInfo.end.ayahNum);

    setFromPage(targetPage);
    setToPage(targetPage);

    setFromJozz(targetJozz);
    setToJozz(targetJozz);

    setFromRangeSurahId(target.surahId);
    setToRangeSurahId(target.surahId);

    setRepeatEnabled(repeat !== 1);
    setRepeatValue(repeat !== 1 ? repeat : 2);
    setRepeatSectionDraft(ayahCount === 0 ? false : repeatSection);
    setDraftRate(rate);
    setAutoFollowDraft(autoFollow);
  }, [
    target,
    surahMetaMap,
    mushafDataset,
    currentPageNum,
    currentJozz,
    reciterId,
    rate,
    repeat,
    repeatSection,
    ayahCount,
    autoFollow,
  ]);

  const isOpen = Boolean(target);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalCardRef.current?.focus({ preventScroll: true });
    return () => {
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const fromSurahTotal = surahMetaMap.get(fromSurahId)?.totalAyat ?? 7;
  const toSurahTotal = surahMetaMap.get(toSurahId)?.totalAyat ?? 7;

  const fromAyahOptions = useMemo(
    () => Array.from({ length: fromSurahTotal }, (_, i) => i + 1),
    [fromSurahTotal]
  );

  const toAyahOptions = useMemo(() => {
    const minAyah = toSurahId === fromSurahId ? fromAyah : 1;
    const len = Math.max(1, toSurahTotal - minAyah + 1);
    return Array.from({ length: len }, (_, i) => minAyah + i);
  }, [toSurahId, fromSurahId, fromAyah, toSurahTotal]);

  const resolvedSelection = useMemo(() => {
    if (scopeType === 'ayah') {
      const start = { surahId: fromSurahId, ayahNum: fromAyah };
      if (rangeMode === 'single') {
        return { start, count: 1 };
      }
      const end = { surahId: toSurahId, ayahNum: toAyah };
      return {
        start,
        count: countAyahsBetween(start, end, surahMetaMap),
      };
    }

    if (scopeType === 'page') {
      const span = getPageAyahSpan(
        mushafDataset,
        fromPage,
        rangeMode === 'single' ? fromPage : toPage,
        surahMetaMap
      );
      if (span) {
        return { start: span.start, count: span.count };
      }
      return { start: { surahId: fromSurahId, ayahNum: fromAyah }, count: 1 };
    }

    if (scopeType === 'jozz') {
      const span = getJozzAyahSpan(
        mushafDataset,
        fromJozz,
        rangeMode === 'single' ? fromJozz : toJozz,
        surahMetaMap
      );
      if (span) {
        return { start: span.start, count: span.count };
      }
      return { start: { surahId: fromSurahId, ayahNum: fromAyah }, count: 1 };
    }

    // scopeType === 'surah'
    const start = { surahId: fromRangeSurahId, ayahNum: 1 };
    const endSid = rangeMode === 'single' ? fromRangeSurahId : toRangeSurahId;
    const endTotal = surahMetaMap.get(endSid)?.totalAyat ?? 1;
    return {
      start,
      count: countAyahsBetween(start, { surahId: endSid, ayahNum: endTotal }, surahMetaMap),
    };
  }, [
    scopeType,
    rangeMode,
    fromSurahId,
    fromAyah,
    toSurahId,
    toAyah,
    fromPage,
    toPage,
    fromJozz,
    toJozz,
    fromRangeSurahId,
    toRangeSurahId,
    mushafDataset,
    surahMetaMap,
  ]);

  const canRepeatSection = resolvedSelection.count > 1;

  if (!target || typeof document === 'undefined') return null;

  const openSurahId = currentPageSurahId ?? target.surahId;
  const isSameActiveTarget =
    activeAudioTarget?.surahId === resolvedSelection.start.surahId &&
    activeAudioTarget?.ayahNum === resolvedSelection.start.ayahNum;
  const isLoadingThisTarget = Boolean(isSameActiveTarget && isLoading);

  const handleChangeFromSurah = (nextSid: number) => {
    const nextTotal = surahMetaMap.get(nextSid)?.totalAyat ?? 7;
    const clampedFrom = Math.max(1, Math.min(nextTotal, 1));
    setFromSurahId(nextSid);
    setFromAyah(clampedFrom);
    if (compareAyahRefs({ surahId: toSurahId, ayahNum: toAyah }, { surahId: nextSid, ayahNum: clampedFrom }) < 0) {
      setToSurahId(nextSid);
      setToAyah(clampedFrom);
    }
  };

  const handleChangeFromAyah = (nextAyah: number) => {
    setFromAyah(nextAyah);
    if (compareAyahRefs({ surahId: toSurahId, ayahNum: toAyah }, { surahId: fromSurahId, ayahNum: nextAyah }) < 0) {
      setToSurahId(fromSurahId);
      setToAyah(nextAyah);
    }
  };

  const handleChangeToSurah = (nextSid: number) => {
    const nextTotal = surahMetaMap.get(nextSid)?.totalAyat ?? 7;
    setToSurahId(nextSid);
    if (nextSid === fromSurahId) {
      setToAyah((prev) => Math.max(fromAyah, Math.min(nextTotal, prev)));
    } else {
      setToAyah(Math.min(nextTotal, 1));
    }
  };

  const handleChangeFromPage = (nextPage: number) => {
    setFromPage(nextPage);
    if (toPage < nextPage) setToPage(nextPage);
  };

  const handleChangeFromJozz = (nextJozz: number) => {
    setFromJozz(nextJozz);
    if (toJozz < nextJozz) setToJozz(nextJozz);
  };

  const handleChangeFromRangeSurah = (nextSid: number) => {
    setFromRangeSurahId(nextSid);
    if (toRangeSurahId < nextSid) setToRangeSurahId(nextSid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartPlayback({
      surahId: resolvedSelection.start.surahId,
      ayahNum: resolvedSelection.start.ayahNum,
      reciterId: draftReciterId,
      rate: draftRate,
      repeat: repeatEnabled ? repeatValue : 1,
      repeatSection: canRepeatSection && repeatSectionDraft,
      ayahCount: resolvedSelection.count,
      autoFollow: autoFollowDraft,
    });
    onClose();
  };

  return createPortal(
    <div
      className="audio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات التلاوة والاستماع"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        ref={modalCardRef}
        tabIndex={-1}
        className="audio-modal-card"
        data-annotation-ui="true"
        onSubmit={handleSubmit}
      >
        {/* Top Action Bar: Close (Right) + Play CTA (Left) */}
        <header className="audio-modal-header">
          <div className="audio-modal-header-right">
            <button
              type="button"
              className="audio-modal-close-btn"
              onClick={onClose}
              aria-label="إغلاق نافذة التلاوة"
              title="إغلاق (Esc)"
            >
              <X className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <h2 className="audio-modal-heading">إعدادات التلاوة</h2>
          </div>

          <div className="audio-modal-header-actions">
            {isPlaying && (
              <button
                type="button"
                className="audio-top-stop-btn"
                onClick={() => {
                  onPausePlayback();
                  onClose();
                }}
              >
                <Pause className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true" />
                <span>إيقاف</span>
              </button>
            )}
            <button type="submit" className="audio-top-play-btn">
              <span>{isPlaying ? 'تطبيق' : 'تشغيل'}</span>
              {isLoadingThisTarget ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <div className="audio-modal-body">
          {/* 1. اختر القارئ */}
          <section className="audio-section" aria-labelledby="audio-sec-reciter">
            <div className="audio-section-head">
              <label id="audio-sec-reciter" htmlFor="audio-modal-reciter" className="audio-section-label">
                اختر القارئ
              </label>
            </div>
            <div className="audio-group-card">
              <div className="audio-reciter-box">
                <span className="audio-reciter-avatar" aria-hidden="true">
                  <Mic className="w-4 h-4" />
                </span>
                <div className="audio-select-wrap is-reciter">
                  <select
                    id="audio-modal-reciter"
                    className="audio-native-select is-reciter"
                    value={draftReciterId}
                    onChange={(e) => setDraftReciterId(e.target.value as ReciterId)}
                  >
                    {QURAN_RECITERS.map((rec) => (
                      <option key={rec.id} value={rec.id}>
                        {rec.name} — {rec.style}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="audio-select-chevron w-4 h-4" aria-hidden="true" />
                </div>
              </div>
            </div>
          </section>

          {/* 2. حدد المقطع */}
          <section className="audio-section" aria-labelledby="audio-sec-range">
            <div className="audio-section-head">
              <span id="audio-sec-range" className="audio-section-label">
                حدد المقطع
              </span>
            </div>

            <div className="audio-group-card is-range-card">
              {/* 4 Scope Tabs */}
              <div className="audio-seg-track is-4" role="tablist" aria-label="نطاق التلاوة">
                {(
                  [
                    { id: 'ayah', label: 'الآية' },
                    { id: 'page', label: 'الصفحة' },
                    { id: 'jozz', label: 'الجزء' },
                    { id: 'surah', label: 'سورة' },
                  ] as const
                ).map((tab) => {
                  const active = scopeType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`audio-seg-tab ${active ? 'is-active' : ''}`}
                      onClick={() => setScopeType(tab.id)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* 2 Mode Tabs: المقطع vs فقط */}
              <div className="audio-seg-track is-2" role="group" aria-label="نوع التحديد">
                <button
                  type="button"
                  aria-pressed={rangeMode === 'range'}
                  className={`audio-seg-tab ${rangeMode === 'range' ? 'is-active' : ''}`}
                  onClick={() => setRangeMode('range')}
                >
                  المقطع
                </button>
                <button
                  type="button"
                  aria-pressed={rangeMode === 'single'}
                  className={`audio-seg-tab ${rangeMode === 'single' ? 'is-active' : ''}`}
                  onClick={() => setRangeMode('single')}
                >
                  فقط
                </button>
              </div>

              {/* Pickers according to Scope + Mode */}
              <div className="audio-pickers-stack">
                {scopeType === 'ayah' && (
                  <>
                    <div className="audio-picker-block">
                      <span className="audio-picker-kicker">
                        {rangeMode === 'range' ? 'من' : 'الآية'}
                      </span>
                      <div className="audio-dual-picker">
                        <div className="audio-pill-select-wrap is-surah">
                          <select
                            aria-label="سورة البداية"
                            className="audio-pill-select"
                            value={fromSurahId}
                            onChange={(e) => handleChangeFromSurah(Number(e.target.value))}
                          >
                            {orderedSurahs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {toArabicDigits(s.id)}. {s.name}
                                {s.id === openSurahId ? ' (المفتوحة)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                        <div className="audio-pill-select-wrap is-num">
                          <select
                            aria-label="رقم آية البداية"
                            className="audio-pill-select is-num"
                            value={fromAyah}
                            onChange={(e) => handleChangeFromAyah(Number(e.target.value))}
                          >
                            {fromAyahOptions.map((num) => (
                              <option key={num} value={num}>
                                {toArabicDigits(num)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                      </div>
                    </div>

                    {rangeMode === 'range' && (
                      <>
                        <div className="audio-card-divider" aria-hidden="true" />
                        <div className="audio-picker-block">
                          <span className="audio-picker-kicker">إلى</span>
                          <div className="audio-dual-picker">
                            <div className="audio-pill-select-wrap is-surah">
                              <select
                                aria-label="سورة النهاية"
                                className="audio-pill-select"
                                value={toSurahId}
                                onChange={(e) => handleChangeToSurah(Number(e.target.value))}
                              >
                                {orderedSurahs
                                  .filter((s) => s.id >= fromSurahId)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {toArabicDigits(s.id)}. {s.name}
                                      {s.id === openSurahId ? ' (المفتوحة)' : ''}
                                    </option>
                                  ))}
                              </select>
                              <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                            </div>
                            <div className="audio-pill-select-wrap is-num">
                              <select
                                aria-label="رقم آية النهاية"
                                className="audio-pill-select is-num"
                                value={toAyah}
                                onChange={(e) => setToAyah(Number(e.target.value))}
                              >
                                {toAyahOptions.map((num) => (
                                  <option key={num} value={num}>
                                    {toArabicDigits(num)}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {scopeType === 'page' && (
                  <>
                    <div className="audio-picker-block">
                      <span className="audio-picker-kicker">
                        {rangeMode === 'range' ? 'من' : 'الصفحة'}
                      </span>
                      <div className="audio-pill-select-wrap">
                        <select
                          aria-label="صفحة البداية"
                          className="audio-pill-select"
                          value={fromPage}
                          onChange={(e) => handleChangeFromPage(Number(e.target.value))}
                        >
                          {pageNumbers.map((p) => (
                            <option key={p} value={p}>
                              صفحة {toArabicDigits(p)}
                              {p === (currentPageNum ?? -1) ? ' (الحالية)' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </div>

                    {rangeMode === 'range' && (
                      <>
                        <div className="audio-card-divider" aria-hidden="true" />
                        <div className="audio-picker-block">
                          <span className="audio-picker-kicker">إلى</span>
                          <div className="audio-pill-select-wrap">
                            <select
                              aria-label="صفحة النهاية"
                              className="audio-pill-select"
                              value={toPage}
                              onChange={(e) => setToPage(Number(e.target.value))}
                            >
                              {pageNumbers
                                .filter((p) => p >= fromPage)
                                .map((p) => (
                                  <option key={p} value={p}>
                                    صفحة {toArabicDigits(p)}
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {scopeType === 'jozz' && (
                  <>
                    <div className="audio-picker-block">
                      <span className="audio-picker-kicker">
                        {rangeMode === 'range' ? 'من' : 'الجزء'}
                      </span>
                      <div className="audio-pill-select-wrap">
                        <select
                          aria-label="جزء البداية"
                          className="audio-pill-select"
                          value={fromJozz}
                          onChange={(e) => handleChangeFromJozz(Number(e.target.value))}
                        >
                          {jozzNumbers.map((j) => (
                            <option key={j} value={j}>
                              الجزء {toArabicDigits(j)}
                              {j === (currentJozz ?? -1) ? ' (الحالي)' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </div>

                    {rangeMode === 'range' && (
                      <>
                        <div className="audio-card-divider" aria-hidden="true" />
                        <div className="audio-picker-block">
                          <span className="audio-picker-kicker">إلى</span>
                          <div className="audio-pill-select-wrap">
                            <select
                              aria-label="جزء النهاية"
                              className="audio-pill-select"
                              value={toJozz}
                              onChange={(e) => setToJozz(Number(e.target.value))}
                            >
                              {jozzNumbers
                                .filter((j) => j >= fromJozz)
                                .map((j) => (
                                  <option key={j} value={j}>
                                    الجزء {toArabicDigits(j)}
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {scopeType === 'surah' && (
                  <>
                    <div className="audio-picker-block">
                      <span className="audio-picker-kicker">
                        {rangeMode === 'range' ? 'من' : 'السورة'}
                      </span>
                      <div className="audio-pill-select-wrap">
                        <select
                          aria-label="سورة البداية"
                          className="audio-pill-select"
                          value={fromRangeSurahId}
                          onChange={(e) => handleChangeFromRangeSurah(Number(e.target.value))}
                        >
                          {orderedSurahs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {toArabicDigits(s.id)}. سورة {s.name} ({toArabicDigits(s.totalAyat)} آية)
                              {s.id === openSurahId ? ' — المفتوحة' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </div>

                    {rangeMode === 'range' && (
                      <>
                        <div className="audio-card-divider" aria-hidden="true" />
                        <div className="audio-picker-block">
                          <span className="audio-picker-kicker">إلى</span>
                          <div className="audio-pill-select-wrap">
                            <select
                              aria-label="سورة النهاية"
                              className="audio-pill-select"
                              value={toRangeSurahId}
                              onChange={(e) => setToRangeSurahId(Number(e.target.value))}
                            >
                              {orderedSurahs
                                .filter((s) => s.id >= fromRangeSurahId)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {toArabicDigits(s.id)}. سورة {s.name} ({toArabicDigits(s.totalAyat)} آية)
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="audio-pill-chevron w-3.5 h-3.5" aria-hidden="true" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* 3. التكرار (تكرار الآية + تكرار المقطع) */}
          <section className="audio-section" aria-label="خيارات التكرار">
            <div className="audio-group-card is-toggles">
              <div className="audio-toggle-item">
                <div className="audio-toggle-row">
                  <span className="audio-toggle-title">تكرار الآية</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={repeatEnabled}
                    aria-label="تكرار الآية"
                    className={`audio-switch ${repeatEnabled ? 'is-on' : ''}`}
                    onClick={() => setRepeatEnabled((prev) => !prev)}
                  >
                    <span className="audio-switch-thumb" />
                  </button>
                </div>

                {repeatEnabled && (
                  <div className="audio-seg-track is-5 audio-repeat-subbar" role="group" aria-label="عدد مرات تكرار الآية">
                    {NON_SINGLE_REPEAT_OPTIONS.map((opt) => {
                      const active = repeatValue === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={active}
                          className={`audio-seg-tab ${active ? 'is-active' : ''}`}
                          onClick={() => setRepeatValue(opt)}
                        >
                          {opt === 0 ? '∞' : `${toArabicDigits(opt)}×`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {canRepeatSection && (
                <>
                  <div className="audio-card-divider" aria-hidden="true" />

                  <div className="audio-toggle-row">
                    <span className="audio-toggle-title">تكرار المقطع</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={repeatSectionDraft}
                      aria-label="تكرار المقطع"
                      className={`audio-switch ${repeatSectionDraft ? 'is-on' : ''}`}
                      onClick={() => setRepeatSectionDraft((prev) => !prev)}
                    >
                      <span className="audio-switch-thumb" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 4. سرعة التلاوة */}
          <section className="audio-section" aria-labelledby="audio-sec-speed">
            <div className="audio-section-head">
              <span id="audio-sec-speed" className="audio-section-label">
                سرعة التلاوة
              </span>
            </div>
            <div className="audio-group-card is-speed">
              <div className="audio-seg-track is-7" role="group" aria-label="اختر سرعة التلاوة">
                {PLAYBACK_RATE_OPTIONS.map((spd) => {
                  const active = draftRate === spd;
                  return (
                    <button
                      key={spd}
                      type="button"
                      aria-pressed={active}
                      className={`audio-seg-tab ${active ? 'is-active' : ''}`}
                      onClick={() => setDraftRate(spd)}
                    >
                      {toArabicDigits(spd)}×
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 5. التتبع التلقائي */}
          <section className="audio-section" aria-label="متابعة التلاوة على المصحف">
            <div className="audio-group-card is-toggles">
              <div className="audio-toggle-row">
                <span className="audio-toggle-title">الذهاب للصفحة وتظليل الآية بشكل تلقائي</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFollowDraft}
                  aria-label="الذهاب للصفحة وتظليل الآية بشكل تلقائي"
                  className={`audio-switch ${autoFollowDraft ? 'is-on' : ''}`}
                  onClick={() => setAutoFollowDraft((prev) => !prev)}
                >
                  <span className="audio-switch-thumb" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>,
    document.body
  );
};
