// يبني بيانات شاشات فيجما من محرك الشباب: يشغّل المحرك على شخصية أحمد وأسعار الذهب والفضة،
// ويحفظ ما تحتاجه الشاشات في src/data/ahmad-view.json. شغّله بعد أي تعديل على المحرك أو البيانات:
//   npm run view
// واختبار src/figma/view.test.js يتأكد أن الملف المحفوظ مطابق لمخرجات المحرك الحالية.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildView } from '../src/engine/view.js';

// buildView انتقل إلى src/engine/view.js حتى يشتغل في المتصفح، ونعيد تصديره هنا للاختبارات القديمة
export { buildView };

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const view = buildView(read('ahmad'), read('prices'));
  writeFileSync(new URL('../src/data/ahmad-view.json', import.meta.url), `${JSON.stringify(view, null, 1)}\n`);
  console.log(`ahmad-view.json: وعاء ${view.total} · زكاة اليوم ${view.due?.zakat} · الوجوب التالي بعد ${view.nextDue?.inDays} يومًا`);
}
