# RHL Performance Management System — ملف تسليم للجلسة الجديدة (Handoff)

اقرأ هذا الملف بالكامل أولاً قبل أي تعديل بالكود. هذا مشروع فعلي قيد التطوير لمكتب محاماة حقيقي (مكتب المحامي رامي الحامد)، مرّ بجولتَي مراجعة معمارية من صاحب المكتب، وكل القرارات أدناه **معتمدة ونهائية** — لا تُعِد فتح نقاش حولها أو تخترع بدائل لها؛ نفّذ عليها مباشرة.

## 1. ملخص المنتج

نظام إدارة تقييم أداء شهري للموظفين بمؤشرات KPI، بالعربية RTL بالكامل، لمكتب له 4 فروع (جدة/الرياض/الدمام/المدينة — غير Hardcoded، بيانات Seed قابلة للتعديل). دوران فقط: **Super Admin** (تحكم كامل) و **Evaluator** (مقيّم بنطاق محدود قابل للتهيئة عبر فرع/قسم/مسمى وظيفي/موظفين محددين). لا يوجد Employee Portal في V1. المقارنة دائمًا **موظف مقابل هدفه**، ولا يوجد أبدًا ترتيب موظف مقابل موظف (Employee Ranking) — هذا محظور صراحة.

الوثيقة الفنية الكاملة (54 قسم أصلي + 27 تصحيحًا معماريًا + Definition of Done بـ36 بندًا) موجودة كمستند منفصل تم إنشاؤه عبر أداة Documents في جلسة سابقة؛ إن كانت متاحة لك في نفس الحساب ابحث عنها، وإلا فهذا الملف يلخّص كل قرار جوهري تحتاجه للاستمرار.

## 2. الحالة الحالية للكود (بصراحة تامة) — محدَّثة بعد جلسة تحقق فعلية على قاعدة بيانات حقيقية

- **`prisma/schema.prisma`**: نموذج v2 كامل ونهائي (انظر §3 أدناه لملخص القرارات). `npx prisma generate` **تم تشغيله فعليًا ونجح** (Prisma Client v5.22.0). لا حاجة لأي إصلاح إضافي هنا.
- **`prisma/seed.ts`**: **تم تشغيله فعليًا بنجاح** على PostgreSQL 16 محلي (`npx prisma db seed`) — كل قوالب KPI الستة أظهرت "مجموع الأوزان = 100% ✓"، وأُنشئ Super Admin + Evaluator تجريبي. ملاحظة: الـSeed لا يُنشئ أي سجلات `Employee` عمدًا (فقط الهيكل التنظيمي: 4 فروع، قسم واحد، 6 مسميات وظيفية، 6 قوالب KPI، صلاحيات، ومستخدمَين) — هذا متوقَّع وليس نقصًا.
- **الخدمات** (`src/lib/services/scoring.ts`, `targetResolution.ts`, `evaluatorScope.ts`, `cycleOpening.ts`, `reviewEngine.ts`, `src/lib/permissions.ts`, `src/lib/audit.ts`): كلها مكتوبة ومطابقة للنموذج الجديد، **ومُختبَرة الآن فعليًا ضد قاعدة بيانات حقيقية** (انظر أدناه) — ليست فقط اختبارات منطق نقي.
- **الاختبارات**: **68/68 اختبار ناجح فعليًا** عبر 6 ملفات (66 + اختبار انحدار إضافي لإصلاح إعادة الفتح بعد الاكتمال - انظر §4):
  - `tests/scoring.test.ts` (29)، `tests/targetResolution.test.ts` (11) — منطق نقي بدون قاعدة بيانات، كما كانت.
  - `tests/evaluatorScope.test.ts` (10) — منطق `assignmentCoversEmployee` (AND/OR) + تكامل فعلي مع DB لـ`getEmployeeVisibilityFilter`/`isEmployeeInEvaluatorScope`.
  - `tests/cycleMaterialization.test.ts` (9) — تكامل فعلي: جاهزية الدورة، إنشاء `PerformanceReview`/`ReviewKpiActual`/`ReviewEvaluator`/`ReviewEvaluatorItem`، Idempotency عند إعادة الفتح، خطأ إعداد الهدف المفقود، ومنع فتح مراجعة لموظف بمجموع أوزان مقيّمين خاطئ.
  - `tests/evaluatorWeightConflict.test.ts` (4) — آلة حالة `recalculatePerformanceReviewStatus` الأربع: COMPLETED (كل الأوزان 100% وكل المقيّمين أرسلوا)، تضارب الأوزان (الجميع أرسل لكن المجموع ≠100% => يبقى AWAITING_EVALUATIONS بلا finalScore)، إرسال جزئي، ولم يبدأ أي أحد.
  - `tests/snapshotImmutability.test.ts` (3) — إثبات فعلي أن تعديل الموظف/الفرع/المسمى/القالب/الهدف الحيّة بعد فتح الدورة **لا يغيّر** أي حقل `*Snapshot` مُجمَّد مسبقًا.
  - أدوات مساعدة مشتركة لهذه الاختبارات في `tests/helpers/dbFixtures.ts` (بناء/تنظيف بيانات معزولة بأسماء `Test*`/`TB_*` فريدة) و`tests/helpers/loadTestEnv.ts` (تحميل `.env` لأن Vitest لا يحمّله تلقائيًا).
  - **ملاحظة بيئية مهمة**: `vitest.config.ts` يضبط `fileParallelism: false` عمدًا — تشغيل ملفات اختبارات التكامل بالتوازي ضد نفس قاعدة Postgres المحلية سبّب أخطاء "P2025 record not found" زائفة (تعارض اتصالات/معاملات متزامنة أثبتناه بإعادة إنتاج مباشرة)، وليس خطأً في كود الخدمات. لا تُعِد تفعيل التوازي بدون معالجة هذا أولاً (مثال: قاعدة بيانات اختبار منفصلة لكل عامل/Worker).
- **قاعدة البيانات**: PostgreSQL 16 عبر Homebrew محليًا (`brew services start postgresql@16`)، قاعدة `rhl_performance` بدور `postgres` بلا كلمة مرور (اتصال Peer/Trust محلي) — `DATABASE_URL` في `.env` (غير مُتتبَّع في git). **تم تنفيذ Migration نظيفة واحدة فعليًا**: `prisma/migrations/20260913102032_init_v2/` عبر `npx prisma migrate dev --name init_v2`، ونجحت دون أي تحذير.
- **واجهات المستخدم (UI)**: **أُعيد بناء كل الشاشات المعطوبة في §4 بالكامل وتم التحقق منها فعليًا (`npx tsc --noEmit` نظيف تمامًا بلا أي خطأ في كامل المشروع، والتحقق اليدوي عبر المتصفح الحقيقي لكل شاشة)**. التفاصيل والحالة الدقيقة لكل شاشة في §4 أدناه — لا تُعِد بناء أي منها من الصفر، فقط أكمل ما تبقى (§5 بند 7).

## 3. القرارات المعمارية المعتمدة (لا تُعد فتحها)

النموذج تحوّل من كيان `Evaluation` مسطّح واحد إلى:

```
EvaluationCycle
  └─ PerformanceReview        (موظف × دورة — الأب، يحمل النتيجة النهائية)
       ├─ ReviewKpiActual     (مؤشر رقمي × مراجعة — القيمة الفعلية المشتركة، سجل واحد فقط لكل الجميع)
       └─ ReviewEvaluator     (مقيّم × مراجعة — وزن مجمَّد وقت الفتح + حالة إرسال مستقلة)
            └─ ReviewEvaluatorItem  (رأي المقيّم الذاتي: Rating/تبرير/ملاحظات)
                 └─ ReviewEvaluatorSubcriterionScore
```

نقاط لا تُناقَش:

1. **ReviewKpiActual مشترك**: القيمة الفعلية (Actual) للمؤشرات الرقمية (NUMBER/PERCENTAGE/CURRENCY) سجل واحد فقط لكل (مراجعة × مؤشر)، يراه كل المقيّمين بالتساوي. لا يجوز أبدًا تكرارها لكل مقيّم.
2. **خوارزمية نطاق المقيّم**: `EvaluatorAssignmentRule` — الحقول داخل نفس القاعدة (branch/department/jobTitle) تُطبَّق **AND**، والقواعد المتعددة (+ الموظفون المحددون بالاسم) تُطبَّق **OR** فيما بينها. تُقيَّم فقط لحظة فتح الدورة لإنشاء `weightSnapshot` مجمَّد.
3. **الأهداف (Target)**: تفرّد عبر `scopeKey` نصي طبيعي (`GLOBAL`/`BRANCH:<id>`/`DEPARTMENT:<id>`/`JOB_TITLE:<id>`/`EMPLOYEE:<id>`) بدل الاعتماد على NULL في Postgres. `applicationMode`: `PER_EMPLOYEE` (يخضع لهرمية Employee→JobTitle→Department→Branch→Global) مقابل `AGGREGATE` (تقارير فقط، مستبعد تمامًا من حل الهدف الفردي).
4. **حساب الإنجاز** (`evaluateAchievement` في `scoring.ts`): Target≤0 مع Higher-Is-Better = خطأ إعداد صريح (لا افتراض 100%). Actual=0 مع Lower-Is-Better = 100% محدود (لا اختلاق 200%). المساهمة = `min(Achievement%,100) × Weight/100` (مثال: 120%,وزن20 → **20**، وليس 18 ولا 24).
5. **اكتمال النتيجة النهائية**: لا تُحسب/تُعتمد `finalScore` لموظف إلا بعد إرسال (Submit) **كل** مقيّميه **و** مجموع أوزانهم = 100% بالضبط؛ قبل ذلك `PerformanceReview.status = AWAITING_EVALUATIONS`.
6. **Snapshot شامل**: كل شيء يؤثر على الحساب (بيانات الموظف، القالب ونسخته، الهدف المُحلَّل، وزن كل مقيّم، تصنيف الأداء) يُنسخ فعليًا في حقول `*Snapshot` وقت فتح الدورة — التعديلات اللاحقة على الإعدادات الحية لا تغيّر أي دورة فُتحت بالفعل.
7. **الصلاحيات منفصلة عن النطاق**: `Permission`/`UserPermission` (ماذا يمكن أن يفعل) منفصلة تمامًا عن `EvaluatorAssignment*` (على من يمكن أن يفعل).
8. **ReportingMetric**: طبقة تصنيف موحّدة فوق KPIs مختلفة (REVENUE, CUSTOMER_SATISFACTION, ...) لتمكين تقارير الفرع/القسم من التجميع.
9. فتح الدورة (`materializeEvaluationsForCycle`) يعمل داخل `prisma.$transaction` ذرّية واحدة.
10. قرارات §9 الأصلية (كلها ما زالت سارية): تخزين المرفقات محليًا على VPS ضمن Volume، Forgot Password معطّل مؤقتًا (إعادة تعيين يدوية من Super Admin + `mustChangePassword`)، بعض Targets تُترك فارغة في Seed بعلامة "يتطلب مراجعة"، صيغة Lower-Is-Better كما في §3.4 أعلاه، اسم Subdomain مؤجل.

## 4. إعادة بناء الشاشات — مكتملة (كانت معطوبة على النموذج القديم، أُعيد بناؤها بالكامل على v2)

كل الشاشات التالية أُعيدت كتابتها بالكامل ضد `PerformanceReview`/`ReviewEvaluator`/`ReviewKpiActual`/`ReviewEvaluatorItem`/`EvaluatorAssignmentRule`، وتم التحقق من كل واحدة منها فعليًا عبر متصفح حقيقي (تسجيل دخول، تعبئة نماذج، تحقق من القيم المحسوبة في قاعدة البيانات مباشرة)، وليس فقط قراءة الكود:

- **`admin/evaluation-cycles/*`**: إنشاء دورة، فتحها (`materializeEvaluationsForCycle`)، عرض تفاصيلها (Snapshot لكل مراجعة + كل مقيّم)، إغلاقها. تم اختبار الإنشاء والفتح فعليًا.
- **`admin/evaluator-assignments/*`**: نموذج القواعد الجديد (كل قاعدة صف AND بين فرع/قسم/مسمى وظيفي أو "كل الموظفين"، والقواعد المتعددة OR بينها) + موظفون محددون منفصلون. تم اختبار قاعدة بسيطة وقاعدة AND مركّبة فعليًا.
- **`admin/targets/*`**: أُضيف حقل `applicationMode` (فردي/إجمالي) للنموذج الذي لم يكن موجودًا في v1. الحفظ يستخدم `buildScopeKey` + `@@unique([kpiId, scopeType, scopeKey, month, year])`. تم اختبار الإنشاء والتحديث (Upsert) فعليًا.
- **`admin/evaluations/*`**: تعمل الآن على `ReviewEvaluator` (مساهمة مقيّم واحد) بدل `Evaluation` المسطّحة. زر "إعادة فتح" يستدعي `recalculatePerformanceReviewStatus` بعد إعادة الفتح — **راجع الإصلاح الحرج أدناه**.
- **شجرة `evaluator/*` بالكامل** (dashboard, employees, evaluate/[id], review/[id], submitted, actions.ts, KpiCard.tsx, BottomBar.tsx, SubmitButton.tsx): مُعاد بناؤها بالكامل. `actions.ts` انقسم منطقيًا إلى `saveActualValue` (القيمة المشتركة على `ReviewKpiActual`، يُعاد حساب كل المقيّمين المتأثرين بها) و`saveItemFields`/`saveSubcriterionScore` (رأي المقيّم الشخصي على `ReviewEvaluatorItem`). تم اختبار السيناريو الكامل حيًا: تسجيل دخول كمقيّم ← تعبئة مؤشر CURRENCY وPERCENTAGE وNUMBER وRATING_1_5 وSUBCRITERIA_RATING (6 مؤشرات) ← مراجعة ← إرسال ← تأكيد أن `finalScore`/`finalPercentage`/`performanceLabelSnapshot` في قاعدة البيانات مطابقة تمامًا لما يحسبه `scoring.ts` يدويًا.
- **`api/attachments/[id]/route.ts`**: مُحدَّث ليقرأ من `ReviewAttachment`/`ReviewEvaluator` بدل النموذج القديم (لم يكن مذكورًا صراحة في القائمة الأصلية لكنه مرتبط مباشرة بمرفقات المقيّم).

### إصلاح حرج تم اكتشافه وإصلاحه أثناء إعادة البناء (وليس مجرد Rename)

`recalculatePerformanceReviewStatus` في `reviewEngine.ts` كان يُحدِّث `status` فقط عند الانتقال بعيدًا عن `COMPLETED` (مثال: إعادة فتح مقيّم بعد اكتمال المراجعة)، **بدون** مسح `finalScore`/`finalPercentage`/`performanceLabelSnapshot`/`completedAt` القديمة. تم إصلاحه بحيث تُمسَح هذه الحقول دائمًا عند أي حالة غير `COMPLETED`. مُغطّى الآن باختبار انحدار دائم في `tests/evaluatorWeightConflict.test.ts` (وصف "إعادة فتح مقيّم بعد اكتمال المراجعة..."). تم التحقق من هذا السيناريو حيًا أيضًا عبر `admin/evaluations` (زر "إعادة فتح").

### إصلاحات صغيرة أخرى غير معمارية (لم تكن في القائمة الأصلية لكنها اكتُشفت أثناء العمل)

- `src/lib/services/reviewEngine.ts`: `validateReviewEvaluatorForSubmit` كان يجلب `kpiTemplate.kpis` بدون `include: {subcriteria: true}` فيسبب خطأ Runtime عند أي مؤشر SUBCRITERIA_RATING. تم إصلاحه.
- `src/lib/auth.ts`: تصحيح نوع `token.role` (كان يُحصَر كـ`string` بدل الـUnion الصحيح).
- `src/lib/notifications.ts`: أُعيد كتابته بالكامل ضد `ReviewEvaluator`/`ReviewKpiActual` (كان لا يزال يستخدم `prisma.evaluation` القديم).
- `src/app/(dashboard)/admin/kpi-templates/actions.ts`: `deleteKpi` كان يتحقق من `prisma.evaluationItem` غير الموجود.
- **`admin/branches`, `admin/departments` (+`new`/`[id]/edit`)**: هذه لم تكن في قائمة "الشاشات المعطوبة" الأصلية (كانت مصنَّفة "تحتاج تعديلاً طفيفًا") لكن تبيَّن أن `actions.ts` فيها كان لا يزال يكتب إلى حقل `Department.branchId` المحذوف — **يمرّ فحص TypeScript بلا خطأ لكنه يتعطّل فعليًا وقت التشغيل** (Prisma يرفض الحقل غير الموجود في وقت التنفيذ لا وقت الترجمة، لأن `data: parsed` تمرَّر كمتغيّر لا كـObject Literal فلا يُفعِّل فحص الحقول الزائدة في TypeScript). أُعيد بناء العلاقة بالكامل عبر `BranchDepartment` (قسم واحد يمكن أن يرتبط بعدة فروع أو بلا أي فرع = متاح للكل)، مع Multi-Select في نموذجَي الإنشاء والتعديل. تم اختبار branches/departments/kpi-templates حيًا بعد الإصلاح.
- `src/app/api/employees/import-template/route.ts`: تحويل `Buffer` إلى `Uint8Array` قبل تمريره لـ`NextResponse` (خطأ نوع غير مرتبط بالترحيل، لكنه كان يمنع `tsc --noEmit` من النجاح بالكامل).

**النتيجة**: `npx tsc --noEmit` نظيف تمامًا (صفر أخطاء) في كامل المشروع، و`npx vitest run` 68/68 ناجحة.

## 5. الخطوات التالية بالترتيب (لا تقفز خطوة)

1. ~~`npm install`~~ **تم ✓**
2. ~~`npx prisma generate`~~ **تم ✓ نجح بلا أخطاء**
3. ~~تجهيز قاعدة بيانات PostgreSQL فارغة، ثم `npx prisma migrate dev --name init_v2`~~ **تم ✓** (PostgreSQL 16 محلي عبر Homebrew، Migration `20260913102032_init_v2`)
4. ~~`npx prisma db seed`~~ **تم ✓ نجح بلا أخطاء** — كل قوالب KPI بمجموع أوزان 100%
5. ~~`npm run test` / `npx vitest run`~~ **تم ✓ 66/66 ناجحة** (40 أصلية + 26 اختبار تكامل جديد لـ evaluatorScope/cycleMaterialization/evaluatorWeightConflict/snapshotImmutability — انظر §2)
6. ~~ابدأ إعادة بناء الشاشات المعطوبة في §4~~ **تم ✓ كل الشاشات الخمس + الإصلاحات الجانبية (branches/departments/kpi-templates) — انظر §4 للتفاصيل الكاملة والاختبارات الحية**
7. ~~لوحة الإدارة الرئيسية + التقارير + تصدير PDF/Excel + Audit Log UI + Notifications~~ **تم ✓ بالكامل — انظر §8 للتفاصيل الكاملة والاختبارات الحية.**
8. **← الخطوة التالية الفعلية**: لا عمل معروف متبقٍ من هذا الملف. إن كانت هناك متطلبات جديدة، أضِفها هنا بدل افتراض أن كل شيء منتهٍ فقط لأن الملف صامت عنها.

## 6. بيانات دخول تجريبية (من Seed)

- Super Admin: `admin@rhl.local` / `ChangeMe123!`
- Evaluator تجريبي: `evaluator@rhl.local` / `ChangeMe123!`

## 7. ملاحظة بيئية

الشبكة (npm registry) كانت محظورة في جلسات سابقة بسبب إعداد Egress على مستوى الجلسة، وتأكد نجاحها في جلسة لاحقة بعد فتح "Network Access → All domains" **وفتح جلسة جديدة** (التغيير لا ينعكس على جلسة شغّالة بالفعل). إن واجهت نفس حظر `403 host_not_allowed` هنا، تحقق من نفس الإعداد قبل افتراض أي مشكلة في الكود.

## 8. لوحة الإدارة + التقارير + التصدير + سجل العمليات + الإشعارات — مكتملة بالكامل

كل ما كان في §5 بند 7 (كان لم يُبنَ إطلاقًا) أُنشئ من الصفر وتم التحقق منه فعليًا (تسجيل دخول حقيقي، بيانات حقيقية، تنزيل ملفات Excel/PDF فعلية وفحص محتواها):

- **`src/app/(dashboard)/admin/page.tsx`** (لوحة الإدارة الرئيسية - `/admin` كانت تعطي 404 لأنها لم تكن موجودة أصلًا): إحصاءات سريعة (موظفون/فروع/مقيّمون/نسبة إنجاز الدورة الحالية)، بطاقة الدورة المفتوحة حاليًا مع شريط تقدّم، آخر 8 عمليات من Audit Log، وتحذير بالموظفين غير الجاهزين لفتح دورة (عبر `getAssignmentCoverage` من `cycleOpening.ts` - إعادة استخدام مباشرة).
- **`src/app/(dashboard)/admin/audit-logs/page.tsx`**: جدول Audit Log كامل مع تصفية (عملية/كيان/مستخدم) وTemplate pagination (50 سجل/صفحة). لا تعديل ممكن - عرض فقط، متوافق مع كون AuditLog سجلًا غير قابل للتعديل.
- **`src/lib/services/reports.ts`** (خدمة مشتركة تُستخدم من الشاشات وواجهات التصدير معًا - DRY):
  - `getEmployeeReport(employeeId)`: سجل PerformanceReview لموظف واحد عبر كل الدورات.
  - `getBranchReport(branchId, cycleId)` / `getDepartmentReport(departmentId, cycleId)`: **مجاميع/متوسطات فقط - لا تُرجع أبدًا قائمة موظفين مُرتَّبة حسب النتيجة** (§1: "لا يوجد أبدًا ترتيب موظف مقابل موظف" - قرار جوهري، تحقّق منه في أي شاشة تقارير مستقبلية). تُستخدم `branchIdSnapshot`/`departmentIdSnapshot` المجمَّدة (وليس علاقة Employee الحيّة) لدقة تاريخية. تُجمِّع أيضًا **`ReviewKpiActual` حسب `Kpi.reportingMetricCode`** مطبِّقةً `ReportingMetric.aggregationMethod` (SUM/AVERAGE/...) - هذا أول استخدام فعلي لـ`ReportingMetric` في كامل المشروع (كان مُعرَّفًا في Seed ومربوطًا بالـKPIs لكن غير مُستخدَم بأي شاشة قبل الآن).
  - شاشات: `admin/reports/{page,employee/page,branch/page,department/page}.tsx` - كل واحدة منها Picker (نموذج اختيار) + عرض النتيجة + زرَّي تصدير.
- **تصدير Excel** (`src/app/api/reports/{employee,branch,department}/export/route.ts`): عبر `exceljs` (كانت مثبَّتة أصلًا لاستيراد الموظفين - أُعيد استخدامها). تم تنزيل وفحص الملفات الثلاثة فعليًا.
- **تصدير PDF** (`src/app/api/reports/{employee,branch,department}/export-pdf/route.ts` + `src/lib/services/pdfExport.ts`): **قرار معتمد صراحة من صاحب المشروع** - يُستخدم Chromium بلا واجهة عبر حزمة `playwright` (وليس pdfkit/react-pdf) لأن هذه المكتبات الخفيفة **لا تدعم تشكيل الحروف العربية (Shaping/Ligatures)** فتُخرِج نصًا عربيًا مكسورًا (حروف منفصلة). تم التحقق فعليًا: تنزيل 3 ملفات PDF حقيقية وفحص محتواها Byte-for-byte - النص العربي **مُشكَّل بشكل صحيح تمامًا ومطابق لما يظهر على الشاشة**، والأرقام (متوسطات/مجاميع/نسب) مطابقة تمامًا للحساب اليدوي.
  - **ملاحظة تاريخية مُتجاوَزة (Superseded)**: الفقرة التالية افترضت وقت كتابتها نشرًا عبر Docker/VPS. هذا الافتراض **أُلغي صراحةً** لاحقًا لصالح Hostinger Cloud Startup (استضافة Node.js مُدارة بلا Docker) - انظر §9 للقرار الفعلي المعتمد. أُبقيت الفقرة كسجل تاريخي فقط: `Dockerfile` تحوَّل من `node:20-alpine` إلى `node:20-bookworm-slim` لكل المراحل، لأن ثنائي Chromium الذي تحمّله Playwright مبني لـglibc وغير متوافق مع musl (Alpine) إطلاقًا. مرحلة `runner` تُنفِّذ `npx playwright install --with-deps chromium`. **لم يُختبَر بناء صورة Docker فعليًا** (لا Docker متاح في بيئة العمل) - الملف مُبقًى فقط كخيار Self-hosted بديل مستقبلي، وليس مسار النشر الحالي.
  - `package.json`: أُضيفت `playwright` كـ`dependency` عادية (وليست devDependency) لأنها مطلوبة وقت التشغيل (Runtime) لا فقط للتطوير.
- **NotificationBell** (`src/components/shared/NotificationBell.tsx`): كان مكتوبًا بالكامل من قبل **لكن غير مُستخدَم في أي مكان** (Dead Code). تم ربطه فعليًا داخل `Header.tsx`/`(dashboard)/layout.tsx` (Prop جديد `notificationBell`). نظام الإشعارات نفسه (`NotificationsList`, `notificationActions.ts`, صفحتا `admin/notifications` و`evaluator/notifications`) كان **مكتملًا وصحيحًا بالفعل من قبل** رغم أن §5 بند 7 كان يذكره كـ"لم يُبنَ بعد" - هذا كان معلومة قديمة/خاطئة في الملف، صُحِّحت الآن.

## 9. قرار النشر المعتمد: Hostinger Cloud Startup (استضافة Node.js مُدارة) + Supabase — لا Docker/VPS/root SSH

**تصحيح مباشر لأي افتراض سابق في هذا الملف عن Docker/VPS كمسار نشر** (§8 أعلاه كتبت قبل هذا القرار): صاحب المشروع أكّد صراحةً أنه **لا يوجد VPS فعلي**، وخطة الاستضافة الفعلية هي **Hostinger Cloud Startup** - استضافة Node.js مُدارة (Managed) بدون أي وصول Root SSH، بدون Docker، وبدون nginx يُدار يدويًا. هذا قرار معتمد نهائي لمسار النشر - **لا تصمّم أو تقترح Docker/VPS/root SSH/nginx يدوي/Postgres محلي كمسار نشر إنتاجي بعد الآن.**

النقاط المعتمدة:

1. **قاعدة البيانات**: PostgreSQL خارجية مُدارة عبر **Supabase** (وليست حاوية Postgres محلية). البنية التطبيقية (Prisma) لا تتأثر - لا تزال PostgreSQL قياسية، لكن `prisma/schema.prisma` أضاف `directUrl` في الـ`datasource` (نمط Supabase الموصى به رسميًا مع Prisma):
   - `DATABASE_URL`: اتصال مُجمَّع عبر pgbouncer (المنفذ 6543، مع `?pgbouncer=true`) - يُستخدم وقت التشغيل العادي.
   - `DIRECT_URL`: اتصال مباشر (المنفذ 5432) - يُستخدم **فقط** وقت `npx prisma migrate deploy` لأن pgbouncer بوضع Transaction لا يدعم بعض أوامر الجلسة التي تحتاجها الهجرات.
   - كلا المتغيّرين إلزاميان معًا الآن (Prisma يفشل إن غاب أحدهما وكان مُشارًا إليه في الـschema) - حتى محليًا (انظر `.env` - ضُبط لنفس قيمة `DATABASE_URL` محليًا لأن Postgres المحلي لا يحتاج تفريقًا).
   - **لم يُنشأ مشروع Supabase فعليًا بعد** - هذا يحتاج من صاحب المشروع إنشاءه (تسجيل حساب/مشروع لا يمكن لأي جلسة عمل نيابة عنه)، ثم تزويد الجلسة التالية بالـConnection Strings الفعلية.

2. **تصدير PDF - لا تفترض توفر Chromium على مستوى نظام التشغيل**: `src/lib/services/pdfExport.ts` أصبح **محرّكًا قابلًا للتبديل** عبر متغيّر البيئة `PDF_ENGINE`:
   - `playwright` (افتراضي): يشغّل Chromium محليًا - يعمل مؤكَّدًا في التطوير المحلي (تم التحقق فعليًا بتنزيل PDF حقيقي وفحص تشكيل النص العربي). **غير مضمون العمل على Hostinger** - قد لا تُسمح بيئة الاستضافة المُدارة بتشغيل Chromium (يحتاج مكتبات نظام قد لا تكون مثبَّتة ولا يمكن تثبيتها بدون صلاحيات Root).
   - `browserless`: يستدعي [Browserless.io](https://www.browserless.io) (خدمة Headless Chrome خارجية عبر HTTP) - يتطلب `BROWSERLESS_API_KEY`. نفس محرك Chromium بالضبط فجودة تشكيل النص العربي مطابقة تمامًا لمسار Playwright، لكن بلا أي حاجة لتثبيت شيء على السيرفر.
   - **قوالب HTML (`reportHtmlShell`/`escapeHtml`) هي مصدر الحقيقة الوحيد ولم تتغيّر** - المحرّك هو فقط ما يحوّلها إلى PDF، تمامًا كما طُلب صراحةً.
   - **لم يتحقق أحد بعد مما إذا كان Chromium يعمل فعليًا على Hostinger Cloud Startup** - هذا يحتاج تجربة فعلية بعد النشر (حاول تصدير PDF حقيقي من الموقع المنشور؛ رسالة الخطأ الودّية في الكود توجّه مباشرة لتفعيل `PDF_ENGINE=browserless` إن فشل). لا تفترض أيًا من الاحتمالين قبل التجربة الفعلية.
   - أيضًا: حزمة `playwright` نفسها تحاول تحميل متصفح Chromium تلقائيًا عند `npm install` (postinstall script) - هذا قد **يُفشل عملية النشر بالكامل** على استضافة مُدارة بحصص تخزين/وقت محدودة. **إن فشل النشر عند `npm install`**، أضِف متغيّر البيئة `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` في إعدادات Hostinger (يتجاوز هذا التحميل التلقائي تمامًا، ويجعل `PDF_ENGINE=browserless` هو المسار العملي الوحيد للتصدير في تلك الحالة).

3. **رفع المرفقات (Attachments) - خطر معماري لم يُحسَم بعد، يحتاج قرارًا صريحًا قبل الاعتماد عليه في الإنتاج**: `src/app/(dashboard)/evaluator/actions.ts` (`uploadAttachment`) و`src/app/api/attachments/[id]/route.ts` يفترضان تخزينًا محليًا على القرص (`UPLOADS_DIR`، افتراضيًا `./uploads`) - هذا افتراض **موروث من قرار VPS+Volume الأصلي في §3.10 وهو الآن غير مؤكَّد الصحة** تحت استضافة مُدارة: لا نعرف إن كانت Hostinger Cloud Startup تضمن تخزينًا دائمًا للملفات عبر عمليات إعادة النشر (Redeploys)، أو إن كان القرص يُعاد تعيينه في كل نشرة جديدة. **لم يُغيَّر أي كود لهذا بعد** لأنه قرار يحتاج تأكيدًا صريحًا من صاحب المشروع (البديل الطبيعي المتاح فورًا: Supabase Storage، بما أن Supabase مُعتمد أصلًا لقاعدة البيانات) - لا تفترض أن الوضع الحالي يعمل في الإنتاج قبل التحقق أو اتخاذ القرار.

4. **متغيّرات البيئة تُضبَط عبر لوحة Hostinger مباشرة** (وليس عبر ملف `.env` مرفوع يدويًا بالضرورة، حسب آلية Hostinger لتطبيقات Node.js) - القائمة الكاملة المطلوبة موجودة ومُوثَّقة في `.env.example` (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `UPLOADS_DIR`, `MAX_UPLOAD_SIZE_MB`, `PDF_ENGINE`, `BROWSERLESS_API_KEY` عند الحاجة، `TZ`).

**لم يتم فعليًا حتى كتابة هذا القسم**: إنشاء مشروع Supabase، إعداد تطبيق Node.js داخل لوحة Hostinger (hPanel)، أي نشر فعلي، أو حسم قرار تخزين المرفقات. هذه كلها خطوات تالية فعلية - لا تفترض أن النشر تم لمجرد وجود هذا القسم.

**التحقق**: `npx tsc --noEmit` نظيف تمامًا (صفر أخطاء)، `npx vitest run` 68/68 ناجحة (لم تُضَف اختبارات Vitest جديدة لهذه المرحلة لأنها شاشات UI/تصدير ملفات لا منطق حسابي جديد - التحقق كان حيًا بالكامل عبر متصفح + curl + فحص الملفات المُصدَّرة فعليًا، وكل بيانات الاختبار اليدوية نُظِّفت من قاعدة البيانات بعد كل تحقق).
