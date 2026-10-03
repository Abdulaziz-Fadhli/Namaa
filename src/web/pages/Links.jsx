// صفحة الروابط (/links): رابط واحد يشاركه الفريق، فيه المنصة والكود
import { ArrowLeft, CodeXml, MonitorSmartphone } from 'lucide-react';
import { Icon } from '../kit.jsx';
import { go } from '../nav.js';
import logo from '../../assets/namaa-logo-tight.png';

const REPO = 'https://github.com/Abdulaziz-Fadhli/Namaa';

export function Links() {
  return (
    <main className="w-links">
      <div className="w-links-in">
        <img className="w-links-logo" src={logo} alt="نماء" />
        <h1>زكاة أموالك من حساباتك البنكية</h1>
        <p>تقرأ حساباتك بصلاحية قراءة فقط، وتعرف متى بدأ حول مالك، وكم زكاتك ومتى تخرجها. الأحكام من دليل هيئة الزكاة والضريبة والجمارك.</p>
        <div className="w-links-list">
          <button className="w-links-btn primary" onClick={() => go('/')}>
            <span className="ic"><Icon as={MonitorSmartphone} size={22} /></span>
            <span className="grow"><b>جرّب المنصة</b><small>namaa-nu.vercel.app</small></span>
            <Icon as={ArrowLeft} size={20} />
          </button>
          <a className="w-links-btn" href={REPO} target="_blank" rel="noreferrer">
            <span className="ic"><Icon as={CodeXml} size={22} /></span>
            <span className="grow"><b>الكود على GitHub</b><small className="ltr">github.com/Abdulaziz-Fadhli/Namaa</small></span>
            <Icon as={ArrowLeft} size={20} />
          </a>
        </div>
        <span className="w-links-foot">مشروع في هاكاثون VentureX · مسار التقنية المالية</span>
      </div>
    </main>
  );
}
