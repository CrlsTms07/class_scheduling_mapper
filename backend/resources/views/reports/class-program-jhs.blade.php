<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    @include('reports.partials.styles')
</head>
<body>
    @if ($isDraft)
        <div class="watermark">DRAFT</div>
    @endif

    @include('reports.partials.header')

    <div class="title">
        <div>{{ $title }}</div>
        <div>School Year {{ $term->schoolYear->name }}</div>
        <div>GRADE {{ $section->gradeLevel->grade }} – {{ mb_strtoupper($section->name) }}</div>
        <div>Class Adviser: <span class="adviser">{{ $adviser ?? '' }}</span></div>
        @if ($coAdviser ?? null)
            <div>Co-Adviser: <span class="adviser">{{ $coAdviser }}</span></div>
        @endif
    </div>

    @php
        $isPublic = $isPublic ?? false;
        $rowCount = collect($blocks)->max(fn ($block) => count($block['rows'])) ?? 0;
        // One TEACHER column at the end, as on the school's form: the teacher of that row's class.
        $teacherOf = function (int $index) use ($blocks) {
            foreach ($blocks as $block) {
                $row = $block['rows'][$index] ?? null;
                if ($row && ! $row['is_break'] && $row['teacher'] !== '') {
                    return $row['teacher'];
                }
            }

            return '';
        };
        $isBreakRow = fn (int $index) => collect($blocks)->every(fn ($block) => ($block['rows'][$index]['is_break'] ?? true));
    @endphp

    <table class="program">
        <thead>
            <tr>
                @foreach ($blocks as $block)
                    <th class="col-time">TIME</th>
                    <th class="col-mins">No. of Mins.</th>
                    <th>{{ mb_strtoupper(str_replace('–', '-', $block['name'])) }}</th>
                @endforeach
                @unless ($isPublic)
                    <th class="col-teacher">TEACHER</th>
                @endunless
            </tr>
        </thead>
        <tbody>
            @for ($index = 0; $index < $rowCount; $index++)
                <tr>
                    @foreach ($blocks as $block)
                        @php $row = $block['rows'][$index] ?? null; @endphp
                        @if ($row === null)
                            <td></td><td></td><td></td>
                        @elseif ($row['is_break'])
                            <td class="break">{{ $row['time'] }}</td>
                            <td class="break">{{ $row['minutes'] }}</td>
                            <td class="break strong">{{ $row['subject'] }}</td>
                        @else
                            <td>{{ $row['time'] }}</td>
                            <td>{{ $row['minutes'] }}</td>
                            <td>{{ $row['subject'] }}</td>
                        @endif
                    @endforeach
                    @unless ($isPublic)
                        <td class="{{ $isBreakRow($index) ? 'break' : '' }}">{{ $teacherOf($index) }}</td>
                    @endunless
                </tr>
            @endfor
        </tbody>
    </table>

    @php
        $minutes = collect($blocks)->pluck('class_minutes')->unique()->values();
        $hours = $minutes->map(fn ($value) => \App\Support\ScheduleFormat::hoursText($value))->implode(' / ');
        $notes = collect(preg_split('/\r\n|\r|\n|;/', (string) ($settings?->reference_note ?? '')))->map(fn ($line) => trim($line))->filter();
    @endphp
    <table class="totals">
        <tr>
            <td class="label" width="16%">Total minutes per day</td>
            <td class="value" width="30%">{{ $minutes->implode(' / ') }} mins.</td>
            <td class="patterns" rowspan="2">
                @foreach ($blocks as $block)
                    <div>{{ $block['name'] }}@if ($block['has_homeroom']) – Inclusive of HGP @endif</div>
                @endforeach
                @foreach ($notes as $note)
                    <div class="note">{{ $note }}</div>
                @endforeach
            </td>
        </tr>
        <tr>
            <td class="label">Total hours per day</td>
            <td class="value">{{ $hours }}</td>
        </tr>
    </table>

    @unless ($isPublic)
        @include('reports.partials.signatures')
    @endunless

    @include('reports.partials.footer')
</body>
</html>
