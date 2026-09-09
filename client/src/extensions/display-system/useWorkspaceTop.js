import { useEffect, useState } from 'react';

/** 跟随宿主顶栏实际下沿分配画布，不用视口百分比制造留白或盖住顶栏。 */
export default function useWorkspaceTop() {
  const [top, setTop] = useState(60);
  useEffect(() => {
    const header = document.querySelector('.title');
    if (!header) return undefined;
    const measure = () => setTop(Math.max(0, header.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return top;
}
