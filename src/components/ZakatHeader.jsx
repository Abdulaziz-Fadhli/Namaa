// رأس قسم الزكاة: العنوان، وتبويبات الوعاء والخط الزمني والإعدادات.
// مشترك بين لوحة الوعاء والخط الزمني.
export default function ZakatHeader({ active, go }) {
  return (
    <>
      <div className="header">
        <h1 className="h1">الزكاة</h1>
        <span className="icon-btn" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 7v5l3 2" />
          </svg>
        </span>
      </div>
      <div className="pills">
        <button className={`pill ${active === 'dashboard' ? 'active' : ''}`} onClick={() => go('dashboard')}>الوعاء</button>
        <button className={`pill ${active === 'timeline' ? 'active' : ''}`} onClick={() => go('timeline')}>الخط الزمني</button>
        {/* شاشة الإعدادات الشرعية (8) من مسؤولية العضو 2 */}
        <button className={`pill ${active === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>الإعدادات</button>
      </div>
    </>
  );
}