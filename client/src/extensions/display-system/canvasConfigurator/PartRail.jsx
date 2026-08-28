import React, { useCallback, useEffect, useRef, useState } from 'react';
import PartTile from './PartTile.jsx';
import { PART_CATEGORIES } from './canvasParts';

/**
 * 底部横向零件栏：一行类别按钮 + 一排可横向滚动的零件方块 + 左右翻页箭头。
 *
 * @param {object} props 零件栏参数。
 * @param {{colormap: object[], overlay: object[], widget: object[]}} props.parts 分组零件。
 * @param {(part: object) => boolean} props.isActive 判断零件是否已生效。
 * @param {(part: object) => void} props.onActivate 点击零件时的处理函数。
 * @param {boolean} props.readOnly 只读模式。
 * @param {string[]} [props.categoryIds] 只显示这几个类别，缺省显示全部。
 *        主界面用它去掉「画布组件」——3D 场景只有一块画布，没有 widget 网格，
 *        列出来会让用户拖进一个没人渲染的卡片。
 */
export default function PartRail({
  parts,
  isActive,
  onActivate,
  readOnly = false,
  categoryIds = null,
}) {
  const categories = categoryIds?.length
    ? PART_CATEGORIES.filter((item) => categoryIds.includes(item.id))
    : PART_CATEGORIES;
  // 一个零件都没有的类别不出按钮 —— 点进去是一片空白比没有这个按钮更让人困惑。
  // 图表两类零件在调用方没接图表表面时就是空的。全空时退回原始清单，
  // 保证下面的 visibleCategories[0] 永远有值。
  const filled = categories.filter((item) => (parts?.[item.id]?.length ?? 0) > 0);
  const visibleCategories = filled.length
    ? filled
    : (categories.length ? categories : PART_CATEGORIES);
  const [category, setCategory] = useState(visibleCategories[0].id);
  const [scrollState, setScrollState] = useState({ atStart: true, atEnd: true });
  const trackRef = useRef(null);

  const syncScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setScrollState({
      atStart: track.scrollLeft <= 1,
      // 容器还没溢出时两端都算到底，箭头一起置灰。
      atEnd: maxScroll <= 1 || track.scrollLeft >= maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    syncScrollState();
  }, [category, parts, syncScrollState]);

  const scrollByPage = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' });
  };

  const activeCategory = visibleCategories.find((item) => item.id === category)
    || visibleCategories[0];
  const items = parts?.[activeCategory.id] || [];

  return (
    <div className="canvas-part-rail">
      <div className="canvas-part-rail-head">
        <div className="canvas-part-categories" role="tablist" aria-label="零件类别">
          {visibleCategories.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={item.id === activeCategory.id}
              className={item.id === activeCategory.id ? 'is-selected' : undefined}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <small>{readOnly ? '系统内置配置只读，无法修改画布' : activeCategory.hint}</small>
      </div>
      <div className="canvas-part-rail-body">
        <button
          type="button"
          className="canvas-rail-arrow"
          aria-label="向左滚动"
          disabled={scrollState.atStart}
          onClick={() => scrollByPage(-1)}
        >
          ‹
        </button>
        <div className="canvas-part-track" ref={trackRef} onScroll={syncScrollState}>
          {items.map((part) => (
            <PartTile
              key={`${part.kind}:${part.id}`}
              part={part}
              active={Boolean(isActive?.(part))}
              disabled={readOnly}
              onActivate={onActivate}
            />
          ))}
        </div>
        <button
          type="button"
          className="canvas-rail-arrow"
          aria-label="向右滚动"
          disabled={scrollState.atEnd}
          onClick={() => scrollByPage(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
