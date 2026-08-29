# Motion Spec V22

| Pattern | Duration | Easing | Properties |
|---|---:|---|---|
| Page/Tab enter | 200ms | cubic-bezier(.2,.8,.2,1) | opacity + transform |
| Modal/Drawer | 200ms | cubic-bezier(.2,.8,.2,1) | opacity + scale/transform |
| Hover/Press | 150ms | ease | background/border/shadow |
| Wizard step | 200ms | cubic-bezier(.2,.8,.2,1) | opacity + translateX |
| Toast | 200ms | ease | opacity + transform |
| Long emphasis | 250ms max | cubic-bezier(.2,.8,.2,1) | transform/opacity |

همه Motionها از `prefers-reduced-motion` پیروی می‌کنند. تغییر مستقیم width/height برای انیمیشن‌های پرتکرار استفاده نشده است.
