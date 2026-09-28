/**
 * Where to scroll `list` so that `el` sits in its vertical centre.
 *
 * ⚠️ Measured from bounding rects, NOT `el.offsetTop`. `offsetTop` is relative
 * to the nearest POSITIONED ancestor, not to the list - so the moment a row
 * gained a `relative` wrapper (the swipe-to-reply gesture, #365), every
 * message's offsetTop became ~0 and tapping a reply quote scrolled to the
 * wrong message. Rects are relative to the viewport for both elements, so the
 * difference is the element's true position inside the list whatever sits in
 * between - and adding `scrollTop` turns it into a scroll target.
 */
export function centredScrollTop(
  list: { scrollTop: number; clientHeight: number; getBoundingClientRect(): { top: number } },
  el: { getBoundingClientRect(): { top: number; height: number } }
): number {
  const l = list.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const within = r.top - l.top + list.scrollTop; // el's top, in list-content coordinates
  return Math.max(0, within - list.clientHeight / 2 + r.height / 2);
}
