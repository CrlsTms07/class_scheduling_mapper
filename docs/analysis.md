# Analysis — ERCIHS Class Scheduling System

Petsa: Nov 6, 2026 (Biyernes). Natitira bago ang deadline: **16 na araw** (hanggang Nov 22).
Para ito sa buong team. Walang code na binago; ito lang ang file na ginawa.

## Pinakamahalagang findings

1. **Hindi kasya ang SHS sa "isang subject, parehong oras, buong pattern."** Sa tunay na SHS
   schedule, 76 sa 94 (81%) na section + time slot ay may magkakaibang subject kada araw. Dapat
   maayos ito bago gawin ang plotter (C1).
2. **Magkasalungat ang `schema.sql` at Spatie / Laravel Auth.** Parehong gumagamit ng table na
   `roles`. Hindi rin kaya ng `users.role_id NOT NULL` ang pending sign-up (C2, C3).
3. **Nababago ang approved entry nang walang reopen.** Kapag pinalitan ang teacher sa loading,
   nagbabago rin ang naka-lock na entry. Na-test ko ito sa PostgreSQL (C4).
4. **UI prototype pa lang ang front-end.** Walang API calls, walang totoong auth, hindi pa
   role-based ang menu, walang kahit isang responsive class, at bagsak ang `npm run build`.
5. **Magandang balita:** gumagana ang conflict design. Na-load nang malinis ang schema, at walang
   teacher o room clash ang tunay na SHS schedule ng school laban sa rules na iyon.
6. **Deadline:** kasya lang ang Must-haves kung halos full-time kayong tatlo **at** tatanggapin
   ang mga simplification sa Section 5. Walang natitirang slack.

## Paano ito sinuri

| Sinuri | Paano | Limitasyon |
|---|---|---|
| Docs, ERD, forms | Binasa lahat, kasama ang hidden sheets ng SHS workbook | Naputol ang taas at ibaba ng JHS photo |
| Front-end | Binasa ang lahat ng app code; pinatakbo ang `npm run build` at `eslint` | **Hindi binuksan sa browser.** Galing sa code ang responsive findings, hindi sa actual na test sa device |
| `schema.sql` | Pinatakbo sa pansamantalang PostgreSQL 18.6 cluster sa temp folder, tapos binura | Hindi ginalaw ang PostgreSQL server ninyo |
| SHS schedule | Na-parse ang 432 na filled day-slots ng 32 sections | Galing sa printed labels. 31 HOPE/Homeroom blocks ang walang teacher, at 43 entries ang walang room, kaya hindi nasama ang mga iyon sa clash check |

Ang "Na-test ✔" sa ibaba ay nangangahulugang pinatakbo ko talaga sa database.

---

## 1. Current state

**Legend:** **done** = gumagana gamit ang totoong data. **partial** = may UI pero dummy data o
kulang. **missing** = wala pa, o placeholder lang.

Sa ngayon, **walang screen na "done"**, dahil wala pang back-end. Sa mga "partial", ang look ang
pinakamagagamit.

### Shared (lahat ng role)

| Screen | Status | Notes |
|---|---|---|
| Login | partial | Maganda ang UI. Pero username ang hinihingi (dapat DepEd email), at kahit anong input ay pumapasok sa system. Walang "View Schedule" button |
| Sign up (pending account) | missing | Wala pang page o route |
| Forgot password | partial | UI lang. Sinasabing "we've sent a link" kahit hindi pa nagsa-submit |
| Reset password | partial | UI lang. Humihingi ng email imbes na token mula sa link |
| Logout | missing | Walang button |
| App layout (header, sidebar) | partial | **Hindi pa role-based.** Pare-pareho ang menu, at naka-hard-code ang user at school year. Walang phone navigation |
| Route protection | missing | Nabubuksan ang `/index/*` kahit walang login |
| Dark mode | missing | May CSS variables, walang toggle (Nice to have) |

### Admin

| Screen | Status | Notes |
|---|---|---|
| Dashboard | missing | Blangko ang lalabas: may menu link pero walang route |
| Approvals (by scope, summary, reopen) | missing | |
| School years at terms | missing | |
| Start New School Year wizard | missing | |
| Calendar settings | missing | |
| Day patterns, time slots, breaks | missing | May `SessionBreak` dialog, pero per-section ito at hindi gumagana. Ibang konsepto ito |
| Sections (yearly encoding) | missing | Placeholder lang ang `SectionsViewIndex`. Hindi rin ito ang `AddSection`, na para sa pag-assign ng section sa room |
| Users, roles, scopes | missing | Menu link lang |
| Signatories, school profile, document settings | missing | |
| Lahat ng reports | missing | |

### GLC (JHS)

| Screen | Status | Notes |
|---|---|---|
| Dashboard | missing | |
| Teachers (CRUD, qualifications, quick-add) | missing | Placeholder lang |
| Subjects | missing | Menu link lang |
| Rooms at buildings | partial | May read-only na listahan (dummy), walang CRUD |
| Teacher loading | missing | Dependency ito ng plotter |
| Schedule plotter | partial | May per-day cards at forms, pero dummy at hindi makapag-submit. Hindi kaya ang day patterns (Section 2.3) |
| Conflict at flag feedback | missing | |
| Submit for approval | missing | |
| Term selector / history | partial | May tabs, pero naka-hard-code na "1st/2nd/3rd Semester" |
| Copy to next term | missing | Should have |
| Reports at exports | missing | Placeholder lang |

### Master Teacher (SHS)

| Screen | Status | Notes |
|---|---|---|
| Lahat ng screen ng GLC | gaya sa itaas | Parehong screens, pero SHS grade levels ang scope |
| Pag-plot ng ibang subject kada araw | missing | Pangunahing pangangailangan ng SHS (C1) |
| Track filter sa sections at subjects | missing | |
| Room-first view | partial | Pinakamalapit sa existing screen, at SHS sample data ang gamit |

### Teacher

| Screen | Status | Notes |
|---|---|---|
| My Schedule (weekly at list) | missing | |
| My Profile | missing | |
| Read-only menu | missing | Nakikita ngayon ang buong menu |

### Guest

| Screen | Status | Notes |
|---|---|---|
| Department → Grade → Section picker | missing | |
| Approved schedule view | missing | |
| "Schedule is being updated" state | missing | |
| Print / PDF | missing | |
| Share link / QR | missing | Should have |

---

## 2. Code review ng existing front-end

### 2.1 Bugs na dapat ayusin

| # | Problema | Saan |
|---|---|---|
| 1 | **Bagsak ang `npm run build`**: 32 TypeScript errors, lahat unused imports o variables. May 31 errors din ang ESLint | Buong `src/` |
| 2 | Tinatanggap ang kahit anong login | [Login.tsx:33](../src/pages/Login.tsx#L33) |
| 3 | Apat na route ang may `path="coming-soon"`, kaya ang una lang ang nagagamit | [App.tsx:32-35](../src/App.tsx#L32-L35) |
| 4 | Hindi makapag-submit ang schedule forms: naka-bind sa `endTime` ang Subject at Teacher, at hindi naka-bind ang Section | [AddSectionToClassroom.tsx:77](../src/features/schedule/AddSectionToClassroom.tsx#L77), [:143](../src/features/schedule/AddSectionToClassroom.tsx#L143), [:177](../src/features/schedule/AddSectionToClassroom.tsx#L177); pareho sa `EditSectionToClassroom` |
| 5 | `SessionBreak` ay gumagamit ng schedule schema (hindi makapag-submit), at may option values na `"apple"` | [SessionBreak.tsx:39](../src/features/schedule/SessionBreak.tsx#L39), [:136](../src/features/schedule/SessionBreak.tsx#L136) |
| 6 | `defaultValue="account"` na walang katugmang tab, kaya blangko ang content pagbukas | [Schedule.tsx:32](../src/pages/Schedule.tsx#L32), [ClassroomScheduleDetail.tsx:39](../src/features/schedule/ClassroomScheduleDetail.tsx#L39), [SectionSubjectDetail.tsx:52](../src/features/schedule/SectionSubjectDetail.tsx#L52) |
| 7 | Magka-crash ang page kapag direktang binuksan ang URL (`state` ay null) | [SectionSubjectDetail.tsx:37](../src/features/schedule/SectionSubjectDetail.tsx#L37) |
| 8 | `step="1"` sa time input: maaaring magbigay ng `HH:mm:ss` na hindi tatanggapin ng `HH:mm` regex. May `defaultValue` at duplicate `id` din sa controlled inputs | [AddSectionToClassroom.tsx:107-110](../src/features/schedule/AddSectionToClassroom.tsx#L107-L110) |
| 9 | Mali ang label ng show-password button (`"Copy"`) | [Login.tsx:98](../src/pages/Login.tsx#L98) |
| 10 | Walang `key` sa mapped tabs; `<li>` na walang `<ul>` | [SectionSubjectDetail.tsx:55](../src/features/schedule/SectionSubjectDetail.tsx#L55), [SubjectDailySchedule.tsx:77](../src/features/schedule/SubjectDailySchedule.tsx#L77) |

### 2.2 Structure

| Lugar | Kalagayan | Dapat gawin |
|---|---|---|
| **Folder layout** | Nasa root ang React. Walang `/frontend` o `/backend`, salungat sa `CLAUDE.md` | Ilipat sa `/frontend` (unang task) |
| **Folder name** | May folder na `features/ComingSoon.tsx/` | Palitan ang pangalan |
| **Routing** | Walang guards. Walang index route sa dashboard. Hindi malinaw ang URL na `/index/...`. Walang ID sa detail routes (gumagamit ng `location.state`) | Gawing `sections/:id`, `rooms/:id`, may `RequireAuth` at `RequireRole` |
| **Role handling** | Wala pa. Isang static array ang menu | Nav config na may `roles`, galing sa `/api/me`; idagdag ang menu para sa Teacher |
| **Server state** | Wala. Hindi pa naka-install ang TanStack Query/Table, dnd-kit, at Vitest. Walang `test` script, kahit nasa `CLAUDE.md` ang `npm run test` | I-install matapos ma-approve; gawin ang `src/api/` |
| **TypeScript** | Puro string at dummy arrays. Walang API types. Hindi ginagamit ang props ng `ScheduleCard` | `src/types/api.ts` na tugma sa schema |
| **Hard-coded** | School year mula sa `new Date()`, "1st/2nd/3rd Semester", "June - August", user na naka-hard-code | Basahin sa API. Lumalabag ang term labels sa rule ng client |
| **Dependencies** | `react-router` 8 at `react-router-dom` 7 ay parehong naka-install, pero walang gumagamit ng huli | Tanggalin ang `react-router-dom` |
| **Styles** | 20 beses na hard-coded ang `#790D16` kahit may `.text-branding` | I-token nang unti-unti; huwag unahin |
| **Duplicate code** | Halos magkapareho ang `AddSectionToClassroom` at `EditSectionToClassroom` | Isang `EntryForm`, gamit sa add at edit |

### 2.3 Kaya ba ng schedule screen ang day patterns?

**Hindi, at kailangang palitan ang logic nito.** Puwedeng panatilihin ang itsura.

- Bawat araw ay hiwalay na listahan ng cards, kaya limang beses mag-e-encode ang user para sa
  iisang subject.
- Tina-type ang oras imbes na pinipili mula sa `time_slots`. Walang konsepto ng pattern, at
  walang pagkakaiba ang Mon–Thu at Friday.
- Per-section at per-day ang breaks. Sa design, bahagi sila ng bell schedule.
- Room muna ang pinipili (Building → Room → Section). JHS ang kailangang section-first.
- Walang weekly grid na may sticky time column.

### 2.4 Responsive (phone portrait at landscape)

**Walang kahit isang `sm:`, `md:`, `lg:`, `portrait:` o `landscape:` class sa app code.** Dahil
dito, inaasahang masisira ang layout sa phone:

| Problema | Epekto sa 360px | Saan |
|---|---|---|
| Laging naka-2 column, may `mx-36` at `px-24` | Halos walang espasyo ang login form | [AuthenticationLayout.tsx:17-35](../src/components/global-component/AuthenticationLayout.tsx#L17-L35) |
| Laging `w-64` / `ml-64` ang sidebar | 104px na lang ang natitira sa content | [Index.tsx:16-19](../src/pages/Index.tsx#L16-L19), [AppSideBar.tsx:72](../src/components/global-component/AppSideBar.tsx#L72) |
| Laging `grid-cols-3` | Napakakikitid ng cards | `ClassroomList`, `RoomDailySchedule`, `SubjectDailySchedule` |
| `w-88` (352px) na field sa loob ng sheet na 270px ang lapad | Lalampas sa screen | `AddSection`, `AddSectionToClassroom`, `EditSectionToClassroom` |
| `w-xl` (576px) na tabs | Lalampas sa screen | [Schedule.tsx:33](../src/pages/Schedule.tsx#L33) |
| `h-screen` imbes na `dvh` | Natatakpan sa mobile browser | `AppSideBar`, `AuthenticationLayout` |
| Buttons na 24–32px | Mas maliit sa 44px na target | `size="xs"`, `icon-sm`, `icon-xs` |
| Email input na walang `type="email"` | Maling keyboard sa phone | `ForgotPassword`, `ResetPassword` |

### 2.5 Reuse o refactor

| Reuse as is | Reuse, may kaunting ayos | Palitan ang logic, panatilihin ang look |
|---|---|---|
| `components/ui/*` | `AuthenticationLayout` (responsive) | `RoomDailySchedule`, `SubjectDailySchedule` (magiging grid at day list) |
| `lib/utils`, `Container` | `AppHeader`, `AppSideBar` (role, drawer) | `AddSection…`, `EditSection…` (magiging isang `EntryForm`) |
| Brand colors at font | `Login`, `Forgot`, `Reset` (API, email, token) | `SessionBreak` (ilipat sa Admin bilang time slot form) |
| Zod password rules | `BreadCrumbs` (raw URL ang label) | `ClassroomList`, `Schedule` (totoong data, card style retained) |
| | `Pagination`, `ScheduleCard` (props) | `RoomLogs`, `SectionLogs` (placeholder; ikabit sa audit logs o alisin) |

Sinusuportahan na ng `Sheet` ang `side="bottom"`, kaya hindi na kailangan ng bagong component
para sa bottom sheet.

---

## 3. Conflicts at gaps

### 3.1 Dapat ayusin bago ang migrations o ang plotter

| # | Problema | Ebidensya | Rekomendasyon |
|---|---|---|---|
| **C1** | "Isang subject sa pattern = isang row bawat araw" ay hindi akma sa SHS. Sa SHS form, Mon–Fri ang columns, at iba-iba ang subject kada araw | 76/94 section-slots | Sa plotter, may **"Apply to days"** checkboxes. Default: buong pattern (JHS), isang araw (SHS). Walang schema change |
| **C2** | `schema.sql` ay may sariling `roles` at `users.role_id`. Gumagawa rin ang Spatie ng `roles` table na iba ang columns | Banggaan ng pangalan ng table | Gamitin ang Spatie tables, tanggalin ang `roles` at `users.role_id`, at ipatupad ang isang role per user sa app. I-update ang schema at ERD |
| **C3** | Pending sign-up ay walang role pa, pero `role_id NOT NULL` | Na-test ✔ (error) | Maaayos kapag sinunod ang C2 |
| **C4** | **Approved entry na nababago.** Dahil sa `ON UPDATE CASCADE`, nagiging ibang teacher ang approved entry kapag binago ang loading | Na-test ✔: entry 1, `approved`, teacher 1 → 2 | I-block sa `ScheduleService` ang pagpalit ng teacher kapag may pending o approved entries, at i-require ang reopen |
| **C5** | Parehong pagbabago sa loading ay puwedeng mag-`23P01` galing sa `section_subjects`, hindi sa schedule endpoint | Na-test ✔ | I-catch din doon, gamit ang parehong conflict message |
| **C6** | Walang flow pagkatapos ma-reject. Pinalalaya ng `rejected` ang slot, kaya kapag kinuha ng iba at ibinalik sa draft, babagsak ito | Na-test ✔ | Tingnan ang F3 |
| **C7** | "HOPE + Homeroom Guidance" ay iisang 120-minute cell sa SHS, walang teacher o room. Hindi ito maisu-submit dahil kailangan ng subject, teacher at room. Hindi rin ito "tumutugma sa isang slot" kung hahatiin sa 60+60 | 31 blocks, halos 1 bawat section | **Itanong sa client** (Q1). Hindi ko dapat hulaan |
| **C8** | Homeroom: 60 minutes ang rule, pero 40 minutes ang HGP sa JHS form. Kung `minutes_per_week = 60`, laging flagged ang HGP dahil "not equal" | JHS photo | Itanong kung exact o maximum (Q2, kaugnay ng open question 5) |
| **C9** | `teacher_load` ay nagbibilang ng classes, hindi subjects. May teacher na 16 classes pero isang subject lang. Limitado pa sa 8 ang `max_subjects`, kaya hindi ito maitataas para sa kanila | Hidden distribution sheets: 2 teachers bawat grade ang lampas 5; 1 ang lampas 8 | Itanong kung classes o subjects ang binibilang, at kung exempted ang PE (Q3) |
| **C10** | Walang lugar para sa "acknowledged" na flag, kahit puwedeng mag-submit kapag acknowledged | Wala sa schema | Dagdag na table (A3) |

### 3.2 Pagkakaiba ng docs at realidad

| # | Problema | Rekomendasyon |
|---|---|---|
| C11 | Sabi ng `CLAUDE.md`, may `/frontend` at "role-based" na layout. Wala pareho | Unang task; i-update ang status |
| C12 | ERD file ay `ERD_Class_Scheduling_System(11-06-26).png`, iba sa nakasulat. Tugma naman ang 26 tables sa schema | I-rename o i-update ang reference |
| C13 | Dalawa ang format ng Class Program: JHS (dalawang block, 4 na signatories) at SHS (Mon–Fri columns, 2 signatories). JHS lang ang inilalarawan ng `CLAUDE.md` | Dalawang template; huwag i-hard-code ang 2×2 |
| C14 | Walang official form para sa Teacher Program at Room Schedule sa `docs/forms/` | Open question 14 |
| C15 | Sabi "SHS rooms are not fixed" at "home room (JHS)". Pero lahat ng 32 SHS sections ay may Room Assignment, at 26 ang gumagamit ng 2 o higit pang rooms | Payagan ang `home_room_id` sa SHS bilang default room |
| C16 | 8 Grade 11 sections ang may **co-adviser**, wala sa schema | Itanong (Q4) |
| C17 | `term_count` ay "2 or 3" sa client-notes, pero 1–4 sa schema at `CLAUDE.md` | Sundin ang 1–4; i-update ang notes |
| C18 | Signatories: "auto from approving Admin" (item 5) laban sa typed names (`CLAUDE.md`). Walang `approver` sa `auto_source`. Iba-iba rin ang labels | Open questions 4 at 12 |
| C19 | Conflict and Validation Report: **Must** sa client-notes (item 7), **Should** sa `CLAUDE.md` | Must ang flags sa plotter; simpleng list report bilang Must |
| C20 | "Overlaps a break" ay soft flag sa isang bahagi, pero "must not" sa iba. Gayundin ang "must match a slot" | Hard sa plotter (slots lang ang napipili). Soft flag kapag nagbago ang bell schedule pagkatapos |
| C21 | QR: "each section has…" sa Guest view, pero Should sa priority | Must ang share link; Should ang QR |
| C22 | Teacher names: `display_name` lang, pero `J. OLOR` sa SHS cells at buong pangalan sa JHS | Kunin ang initial + apelyido; walang bagong column |

### 3.3 Iba pang gaps

- **Laravel at schema:** `password_hash` laban sa inaasahang `password`; kulang ng
  `remember_token`, `sessions`, at `password_reset_tokens`.
- **`migrate:fresh --seed`:** naiiwan ang custom types (`timerange`, enums), kaya babagsak ang
  ulit na migration. Gamitin ang `--drop-types` o `DROP TYPE IF EXISTS`.
- **Pest:** dapat PostgreSQL ang test database. Hindi gagana sa SQLite ang exclusion constraints.
- **Mga rule na hindi ipinapatupad ng DB** (Na-test ✔, tinanggap): term 3 kapag `term_count=2`;
  term dates sa labas ng school year; non-teaching na adviser; duplicate `report_settings` kapag
  NULL ang `level`. Dapat nasa Form Requests o `NULLS NOT DISTINCT`.
- **Bell schedule edits:** walang `time_slot_id` ang entries, kaya mapag-iiwanan ang mga ito kapag
  binago ang slot.
- **Bell schedule per grade:** walang `grade_level_id` ang `day_patterns` (open question 13).
- **Pag-link ng user at teacher:** walang email sa `teachers`, at walang nakasaad kung paano
  ikokonekta ang sign-up sa personnel record. Dapat piliin ito ng Admin sa activation.
- **Walang may-ari ang CRUD:** departments, designations, tracks, teaching tasks.
- **`review_id`:** pinakahuling review lang ang natatandaan ng entry. Dapat sa audit log ang
  history.
- **Swap ng dalawang entries:** Na-test ✔, bumabagsak sa isang `UPDATE`. Sa API, delete + insert
  sa isang transaction, o gawing `DEFERRABLE` ang constraint.
- **Copy to next term:** Na-test ✔, nakareserba ang room ng open slot. Kapag may entries na sa
  target term, dapat i-skip at i-report, hindi bumagsak.
- **`grade_levels.period_minutes`:** hindi na ginagamit; puwedeng alisin.
- **Footer:** may Facebook page line ang form na wala sa `school_profile`.
- **Totals:** kasama ang breaks sa totals ng SHS form (6:00–2:30 = 8.5 hours). Blangko ang sa JHS
  photo. Kung pareho ang rule, 595 minutes ang Mon–Thu at 600 ang Friday; kung hindi kasama ang
  breaks, 555 at 560.
- **Deployment:** wala pang napiling hosting at email sender, na kailangan ng password reset.

### 3.4 Mga tanong para sa client

May 14 na open questions na sa `docs/client-notes.md`. Ang **pinakakailangan agad** doon: **#1**
(isa o maraming GLC), **#5** (Homeroom), **#6 at #13** (bell schedules), **#7** (tracks), **#14**
(forms). Mga bagong tanong:

| # | Tanong | Bakit mahalaga | Kailan kailangan |
|---|---|---|---|
| Q1 | Sa SHS, ano ang ibig sabihin ng "HOPE" at "HOMEROOM GUIDANCE" sa iisang 120-minute cell na walang teacher at room? 60+60 ba? Sino ang teacher, at saan? | Hindi ito mailalagay sa schema ngayon | **Bago ang plotter** |
| Q2 | Exact 60 minutes ba ang Homeroom o maximum? Bakit 40 sa JHS form? | Rule ng flag | **Bago ang plotter** |
| Q3 | "Max 5 subjects": classes ba o magkakaibang subjects? Exempted ba ang PE? | Puwedeng ma-flag nang mali ang ilang teachers | Bago ang loading |
| Q4 | Kailangan bang i-print o itala ang co-adviser? | Schema | Bago ang migrations |
| Q5 | Kasama ba ang breaks sa "Total minutes per day" ng JHS? | Report | Bago ang reports |
| Q6 | Puwede bang magbago ang bell schedule sa kalagitnaan ng term o sa pagitan ng terms? | Lock o versioning | Bago ang time slots |
| Q7 | Pareho bang format ang kailangan para sa lahat ng grade levels, at maibibigay ba ang Word/Excel na original? | Naputol ang photo | Bago ang reports |
| Q8 | Puwede bang gamitin ang tunay na schedule (naka-anonymize) sa testing? | Golden test (I3) | Bago ang testing |
| Q9 | Saan ide-deploy, at may email ba ang school para sa password reset? | Kailangan sa deployment | Sa lalong madaling panahon |

**Para sa team, hindi sa client:** aling version ng ISO 25010 ang gusto ng panel (2011 o 2023), at
ilang oras bawat araw ang kaya ng bawat member.

**Kung mabagal sumagot ang client**, ang mga pansamantalang assumption ay kailangang i-approve
ninyo: kaya ng scope design ang isa o maraming GLC, kaya hindi ito hadlang; AM/PM bell schedule bawat level; HGP bilang
regular na subject na may sariling minutes.

---

## 4. Suggestions

Lahat ito ay **proposal lang**, naghihintay ng approval. Walang pagbabago sa tech stack o pag-alis
ng client requirement.

### 4.1 User flow

> 💡 **F1. Suggestion:** Setup checklist sa Admin dashboard: School year → Time slots → Sections →
> Users → Signatories, bawat isa may status at link.
> **Why:** Malinaw ang susunod na gagawin, lalo na kung isang beses sa isang taon lang ginagawa.
> **Effort:** small
> **When:** now

> 💡 **F2. Suggestion:** Readiness card bago ang plotter ("3 sections walang adviser, 12 subjects
> walang teacher"), may link papunta sa aayusin.
> **Why:** Hindi malilito ang GLC kung bakit walang lumalabas sa dropdown.
> **Effort:** small
> **When:** now

> 💡 **F3. Suggestion:** Malinaw na "Revise" action: `rejected → draft`, nakikita ang remarks ng
> Admin, at kapag may slot nang nakuha ng iba, ililista ang mga iyon imbes na bumagsak.
> **Why:** Walang ganitong hakbang sa flow ngayon (C6).
> **Effort:** small
> **When:** now

> 💡 **F4. Suggestion:** Section schedule status view (`section_term_status`): not started / draft /
> pending / approved / rejected / reopened, kinukuha mula sa entries.
> **Why:** Isang source of truth para sa dashboard, approvals at guest view. Maiiwasan ang
> magkakaibang query.
> **Effort:** small
> **When:** now

> 💡 **F5. Suggestion:** Gawing simpleng in-app count ang bell icon (pending approvals para sa Admin,
> rejected para sa scheduler). Walang email o realtime.
> **Why:** Nasa UI na ang bell, at sapat ito para makumpleto ang approval loop.
> **Effort:** small
> **When:** now, kung may oras

### 4.2 Plotter UX

> 💡 **P1. Suggestion:** "Apply to days" sa `EntryForm` (C1).
> **Why:** Iisang screen para sa JHS at SHS, at isang tap lang para sa buong pattern.
> **Effort:** small
> **When:** now (kailangan)

> 💡 **P2. Suggestion:** Section-first plotter, may side panel ng loading: bawat subject ay may
> natitirang minutes ("Math 80 / 400"). Pipiliin ang subject, tapos tap sa slot. Awtomatikong
> mapupunan ang teacher, at ang home room ang default room.
> **Why:** Pinakamabilis na encoding, at nakikita agad ang kulang. Ito rin ang tap-to-assign na
> hinihingi sa phone.
> **Effort:** medium
> **When:** now

> 💡 **P3. Suggestion:** Unahin ang tap-to-assign; idagdag ang dnd-kit drag bilang enhancement sa
> dulo.
> **Why:** Kailangan ang tap sa phone, at gumagana rin sa desktop. Kung maantala, hindi mawawala ang
> pangunahing flow. Mananatili ang dnd-kit sa stack.
> **Effort:** small (nakakatipid ng tinatayang 2 person-days)
> **When:** now

> 💡 **P4. Suggestion:** Availability endpoint: bago mag-save, naka-gray na sa dropdown ang teachers
> at rooms na occupied, kasama ang dahilan ("Teaching 8-Rizal").
> **Why:** Pinipigilan ang error imbes na iulat pagkatapos. Madali ring gamitin para sa "suggested
> free rooms" sa 422.
> **Effort:** medium
> **When:** now

> 💡 **P5. Suggestion:** "Copy from another section" para sa magkakaparehong sections (STEM 11-1 →
> 11-2), na may ulat ng mga hindi nakopya.
> **Why:** 32 sections sa SHS pa lang, kaya malaking oras ang matitipid.
> **Effort:** medium
> **When:** after evaluation, o now kung nauuna kayo

> 💡 **P6. Suggestion:** Isang `ScheduleGrid` / `ScheduleDayList` component para sa plotter, section,
> teacher, room at guest views (magkakaiba lang ang data at actions).
> **Why:** Limang screen na mababawasan sa isang implementation, at awtomatikong responsive lahat.
> **Effort:** medium (pero nakakatipid sa kabuuan)
> **When:** now

### 4.3 Printed documents

> 💡 **D1. Suggestion:** Isang `ReportService` na gumagawa ng data, tapos magkakahiwalay na Blade
> templates (JHS block, SHS columns, teacher, room). Subukan ang dompdf sa tunay na layout sa unang
> linggo.
> **Why:** Limitado ang CSS ng dompdf (tables ang pinakaligtas). Mas mabuting malaman ito nang maaga.
> **Effort:** small (para sa spike)
> **When:** now

> 💡 **D2. Suggestion:** "DRAFT" watermark sa hindi pa approved na prints.
> **Why:** Maiiwasang kumalat ang hindi opisyal na schedule.
> **Effort:** small
> **When:** now

> 💡 **D3. Suggestion:** Batch print: lahat ng sections ng isang grade level sa isang PDF.
> **Why:** Ganito ginagamit ng school ang workbook nila (maraming section sa isang sheet).
> **Effort:** small
> **When:** now, kung may oras

> 💡 **D4. Suggestion:** I-save ang kopya ng signatories at report settings sa approval.
> **Why:** Hindi magbabago ang lumang dokumento kapag nagpalit ng opisyal.
> **Effort:** medium
> **When:** after evaluation

### 4.4 Database at API

> 💡 **A1. Suggestion:** Ayusin ang schema bago mag-migrate (v5): C2, C3, `password`, at ang mga
> sagot sa Q1 at Q4. I-update ang ERD nang sabay.
> **Why:** Pinakamura itong baguhin ngayon.
> **Effort:** small
> **When:** now

> 💡 **A2. Suggestion:** Batch endpoint para sa pag-plot, isang transaction bawat request; ibinabalik
> lahat ng conflict kada araw nang sabay.
> **Why:** Hindi kalahating naka-save ang pattern, at isang mensahe lang ang makikita ng user.
> **Effort:** small
> **When:** now

> 💡 **A3. Suggestion:** Table na `schedule_flag_acknowledgements` (term, section, flag type, ref,
> sino, kailan, note). Kinukuwenta on-the-fly ang flags, hindi sine-save.
> **Why:** Kailangan ng rule (C10), at hindi nagiging lipas ang flags.
> **Effort:** small
> **When:** now

> 💡 **A4. Suggestion:** I-lock ang pag-edit ng time slots kapag may entries na sa pattern, maliban sa
> pagdaragdag ng slot.
> **Why:** Pinakasimpleng paraan para hindi maligaw ang entries. Hindi na kailangan ng `time_slot_id`.
> **Effort:** small
> **When:** now

> 💡 **A5. Suggestion:** Bulk import (XLSX/CSV) ng teachers, rooms, subjects at sections. Laravel Excel
> na ang gamit, kaya walang bagong package.
> **Why:** Mahigit 50 teachers at 32 SHS sections pa lang. Mas mabilis din ang setup bago ang
> evaluation.
> **Effort:** medium
> **When:** now para sa teachers lang; ang iba, after evaluation

### 4.5 Performance, security, data integrity

> 💡 **S1. Suggestion:** Isang helper para sa grade-level scope (`Section::visibleTo($user)`), at Pest
> test matrix bawat role.
> **Why:** Hindi malilimutan ang scope, at mapapatunayan ninyo ito sa defense.
> **Effort:** small
> **When:** now

> 💡 **S2. Suggestion:** Hiwalay na guest API at Resource (minimal fields, walang email o IDs ng user),
> at throttling sa login, sign-up, forgot password at guest.
> **Why:** Public ang guest view, at lumalabas dito ang pangalan ng mga guro (open question 11).
> **Effort:** small
> **When:** now

> 💡 **S3. Suggestion:** **Huwag i-commit ang `docs/forms/` at real data hangga't hindi kumpirmado.**
> May tunay na pangalan ng personnel at sections ang workbook, at hindi pa ito naka-commit ngayon.
> Hindi ko na-verify kung private ang GitHub repo. Gumamit ng synthetic seeders.
> **Why:** Data Privacy Act (RA 10173) at tiwala ng client.
> **Effort:** small
> **When:** now, bago ang susunod na `git add`

> 💡 **S4. Suggestion:** `Model::preventLazyLoading()` sa dev, indexes sa `section_subjects(teacher_id,
> term_id)` at `schedule_entries(section_id, term_id)`, at iisang eager-loaded query para sa grid.
> **Why:** Iwas N+1 sa grid at reports. Maliit ang data, kaya sapat na ito; hindi kailangan ng cache.
> **Effort:** small
> **When:** now

> 💡 **S5. Suggestion:** Araw-araw na `pg_dump` sa server, at isa bago ang wizard at bulk approve.
> Isang `AuditLogger` service para sa approve, reject, reopen, copy, wizard at role changes.
> **Why:** Madaling mabawi ang mga pagkakamali, at malinaw kung sino ang gumawa.
> **Effort:** small
> **When:** now

### 4.6 ISO 25010 evaluation

> 💡 **I1. Suggestion:** Kumpirmahin sa adviser ang version (2011 o 2023, magkaiba ang characteristics
> at pangalan), tapos gumawa ng matrix: characteristic → feature → ebidensya.
> **Why:** Direktang tugma ang questionnaire sa system at mas madaling ipagtanggol.
> **Effort:** small
> **When:** now

> 💡 **I2. Suggestion:** Madaling sukating ebidensya: Pest at Vitest results, Lighthouse sa limang
> viewport, response time ng plotter at PDF, at responsive checklist.
> **Why:** Mas matibay kaysa puro survey results.
> **Effort:** small
> **When:** Nov 20–22

> 💡 **I3. Suggestion:** "Golden dataset": i-import ang naka-anonymize na SHS schedule bilang
> acceptance test. Inaasahan: 0 hard conflicts, tamang total hours, at tugma ang printed form.
> **Why:** Pinakamalakas na patunay ng functional correctness, gamit ang tunay na data ng school. May
> mga typo pa sa workbook (hal. section label na mali ang cell), na magandang argumento rin para sa
> system.
> **Effort:** medium
> **When:** now, kung papayag ang client (Q8)

> 💡 **I4. Suggestion:** Malinaw na empty states, conflict messages sa simpleng English, at maikling
> help text sa wizard at plotter.
> **Why:** Direktang nakakatulong sa usability scores, at mababa ang effort.
> **Effort:** small
> **When:** now

---

## 5. Development plan hanggang Nov 22

### 5.1 Kakasya ba?

**Hindi kasya ang buong scope kung hindi pasisimplehin. Kasya ang Must-haves kung halos full-time
kayo.** Tantya ko lang ang mga numerong ito, hindi sukat:

| | Person-days |
|---|---|
| Capacity (3 members × 16 araw, full-time) | 48 |
| Must-haves, buong detalye | ~50 |
| Must-haves, kasama ang simplifications sa ibaba | ~41 |

**⚠️ Deadline risk:** Halos 85% ng full-time capacity ang 41. Kung may klase o trabaho kayo at nasa
kalahati lang ang oras (mga 24 person-days), **hindi ito kakasya**, at kakailanganin ang "Minimum
version" sa 5.4.

### 5.2 Mga pasimpleng hindi nag-aalis ng requirement

| Pasimple | Natitipid |
|---|---|
| Tap-to-assign muna, drag-and-drop sa dulo (P3) | ~2 araw |
| Isang `ScheduleGrid` para sa lahat ng views (P6) | ~2 araw |
| Isang page para sa Terms at Calendar settings | ~1 araw |
| Maganda ang PDF ng 3 documents; simple pero kumpleto ang XLSX ng Teacher at Room | ~2 araw |
| Sa wizard: i-defer ang "section names with grade + 1" | ~0.5 araw |
| Reusable CRUD pattern (isang table/card component) | ~1.5 araw |

**Huwag munang gawin:** auto-fill, custom color schemes, dark mode toggle, batch print (kung kapos),
at CSV export.

### 5.3 Step-by-step, ayon sa dependencies

**Member A:** Back-end at database. **Member B:** App shell, Admin screens, CRUD, Guest.
**Member C:** Plotter, schedule views, reports.
Palitan ang mga letra ayon sa lakas ng bawat isa. Gumagana ang hatian para sabay kayong makakilos,
pero dapat maipaliwanag ng bawat member ang gawa ng iba para sa defense.

| # | Task | Sino | Priority | Depends on | Target |
|---|---|---|---|---|---|
| 1 | Sagutin ang blocking decisions; i-update ang schema (A1) | Lahat | Must | — | Nov 6–7 |
| 2 | Monorepo, Laravel setup, migrations, seeders, conflict tests (Section 6) | A | Must | 1 | Nov 7–8 |
| 3 | Green build, routing, API client, role-aware layout, drawer, responsive auth pages | B | Must | — (kasabay ng 2, pagkatapos ng repo move) | Nov 8–10 |
| 4 | Auth: login, logout, sign-up, activation, reset, RBAC, scope helper (S1) | A + B | Must | 2, 3 | Nov 8–10 |
| 5 | **Unang deploy sa staging** (Sanctum, CORS, HTTPS, mail) | A | Must | 4 | Nov 10–11 |
| 6 | School years, terms, wizard, active term | A + B | Must | 4 | Nov 9–11 |
| 7 | Day patterns, time slots, breaks, copy pattern | A + B | Must | 6 | Nov 10–12 |
| 8 | CRUD: teachers + quick-add, subjects, rooms, buildings, tracks, departments | A + B | Must | 4, 6 | Nov 10–12 |
| 9 | Sections (Admin), users, roles, scopes; signatories at school profile | B | Must | 8 | Nov 11–13 |
| 10 | Dompdf spike gamit ang tunay na JHS at SHS layout (D1) | C | Must | 2 | Nov 9–10 |
| 11 | `ScheduleGrid` at day list, gamit muna ang mock data | C | Must | 3 | Nov 9–11 |
| 12 | Teacher loading (API + screen) | A + C | Must | 8, 9 | Nov 13–14 |
| 13 | `ConflictService`, `ScheduleService`, batch API, flags, acknowledgements | A | Must | 7, 12 | Nov 13–15 |
| 14 | Plotter: tap-to-assign, apply-to-days, bottom sheet, flags, conflict messages | C | Must | 11, 13 | Nov 13–16 |
| 15 | Submit, approvals by scope, summary, reject, revise, reopen, audit | A + B | Must | 13, 14 | Nov 15–17 |
| 16 | Admin at scheduler dashboards, checklist | B | Must | 15 | Nov 16–17 |
| 17 | Teacher: My Schedule at Profile; term selector / history | C | Must | 11, 13 | Nov 16–17 |
| 18 | Guest view, share link; Print/PDF kapag tapos ang 19 | B | Must | 15, 19 | Nov 17–19 |
| 19 | Class Program, Teacher Program, Room Schedule + room usage (PDF + XLSX) | C + A | Must | 10, 13 | Nov 15–19 |
| 20 | Simple Conflict and Validation list; teacher load report | A | Must (C19) | 13 | Nov 18–19 |
| 21 | Copy to next term | A + C | Should | 13, 14 | Nov 19–20 |
| 22 | QR, availability endpoint (P4), bulk teacher import (A5) | B / A | Should | Kung nauuna | Nov 19–20 |
| 23 | Drag-and-drop (dnd-kit) | C | Should | 14 | Nov 20 |
| 24 | **Responsive pass sa 5 viewports**, bug fixing, golden test, seed ng evaluation data | Lahat | Must | Lahat | Nov 19–21 |
| 25 | **Feature freeze; final deploy; backup; ISO matrix at evidence** | Lahat | Must | 24 | Nov 21–22 |
| 26 | Grade level timetable, batch print, dark mode | Sinuman | Nice | Kung may oras | Pagkatapos ng 25 |

### 5.4 Checkpoints at plan B

| Petsa | Dapat tapos | Kung hindi |
|---|---|---|
| Nov 8 | Migrations at conflict tests, green | Tigil muna sa lahat; ito ang pundasyon |
| Nov 11 | Login at staging URL gumagana | Pasimplehin ang wizard (presets lang) |
| Nov 16 | Isang section na na-plot end-to-end, sa phone din | Tanggalin lahat ng Should; XLSX ng Class Program lang |
| Nov 19 | May approval at 3 PDFs | Itigil ang bagong features; bug fixing na lang |

**Minimum version kung kapos ang oras:** Panatilihin ang auth, setup, loading, plotter, approvals,
3 PDFs, Teacher view, Guest view, at ang responsive na basic layout. I-defer ang lahat ng Should at
XLSX ng Teacher at Room. **Dapat munang ipaalam sa client at adviser** ang anumang kulang sa Must,
dahil requirement ang mga iyon.

---

## 6. Unang task

### Rekomendasyon: Project foundation (monorepo + Laravel + database)

**Bakit ito:** Lahat ng ibang task ay nakadepende rito. Dito rin nagiging totoo ang pinakamalaking
risk ng project, ang conflict detection. Tinatayang 1.5–2 person-days.

**Hindi kasama:** pagbuo ng screens o API endpoints; bahagi iyon ng mga susunod na task.

### Kailangan ng approval bago magsimula

| # | Desisyon | Rekomendasyon ko |
|---|---|---|
| 1 | Roles (C2, C3) | Spatie tables; tanggalin ang `roles` at `users.role_id` |
| 2 | `users.password_hash` | Palitan ng `password` para sa Laravel Auth |
| 3 | Pag-install ng packages | Laravel, Sanctum, Spatie, Laravel Excel, dompdf, Pest (lahat nasa stack). Sa React, sa task 3 ang iba |
| 4 | Ilipat ang React sa `/frontend` | Oo, pero **i-commit muna ang kasalukuyan mong trabaho**, at huminto muna ang team sa pag-edit sa `src/` habang inililipat |
| 5 | Ano ang ico-commit sa `docs/` | Huwag muna ang `docs/forms/` (S3) |
| 6 | Sagot sa Q1 at Q4 | Kung wala pa: walang schema change para sa HOPE/Homeroom at co-adviser; idadagdag sa bagong migration pagdating ng sagot |

### Mga hakbang

1. **Ayusin ang Git.** Ikaw ang magko-commit ng 4 na binagong file at mga bagong folder sa
   `src/features/`. Gagawa ng branch na `chore/project-foundation` mula roon. Hindi ako magpu-push.
2. **Ilipat sa `/frontend`** gamit ang `git mv`, para mapanatili ang history. I-verify na tumatakbo
   ang `npm run dev`.
3. **Ayusin ang build:** tanggalin ang 32 unused imports at variables, at ang `react-router-dom`.
   Hiwalay na commit. Walang pagbabago sa itsura.
4. **Gumawa ng `/backend`** gamit ang Laravel at ang approved packages. PHP 8.4, Composer, at
   PostgreSQL 18 ay naka-install na sa machine mo. Panatilihing updated ang `.env.example`, at
   tiyaking ignored ang `.env`.
5. **I-convert ang `schema.sql` (v5) sa migrations**, ayon sa pagkakasunod-sunod ng dependencies:
   - extension, `timerange`, at enums, gamit ang raw statements at `DROP TYPE IF EXISTS`
   - users at Spatie tables, calendar, grade levels, day patterns, time slots
   - rooms, personnel, curriculum, sections, section subjects
   - reviews, `schedule_entries` kasama ang composite FK at 3 exclusion constraints (raw SQL)
   - report tables, audit logs, 3 views, at indexes (S4)
6. **Seeders:** roles, grade levels 7–12, demo users bawat role (`@deped.gov.ph`), isang school year
   na may terms, JHS Mon–Thu at Friday patterns batay sa form, at **synthetic** na sections,
   teachers at subjects.
7. **Pest tests sa PostgreSQL** (hiwalay na test database). Lahat ng kinakailangan ng `CLAUDE.md`:

   | Test | Inaasahan |
   |---|---|
   | Teacher, room, section overlap | Blocked (`23P01`) |
   | Back-to-back (7:00–7:45, 7:45–8:30) | Allowed |
   | Ibang araw; ibang term | Allowed |
   | Rejected entry | Ignored |
   | Open slot (NULL teacher) | Walang teacher conflict; hindi maisu-submit |
   | Homeroom na lampas 60 minutes | Lumalabas sa `subject_minutes_check` (ang badge at submit block ay sa task 13) |
   | Di-DepEd na email | Blocked |
   | Dalawang active terms | Blocked |

8. **I-update ang docs:** `schema.sql` v5, ERD, at ang layout at status sa `CLAUDE.md`.

### Paano ito ite-test

```bash
cd backend
php artisan migrate:fresh --drop-types --seed
./vendor/bin/pest

cd ../frontend
npm run build
npm run dev        # dapat kapareho pa rin ang itsura
```

**Tapos ito kapag:** paulit-ulit na tumatakbo ang migration nang walang error, lahat ng Pest tests ay
pumapasa, at green ang front-end build.

**Suggested commit messages:**

- `chore: move React app to /frontend and fix build errors`
- `feat(backend): add Laravel project, migrations, seeders and conflict constraint tests`
