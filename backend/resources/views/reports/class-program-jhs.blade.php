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
        <div>{{ $term->name }}, School Year {{ $term->schoolYear->name }}</div>
        <div>GRADE {{ $section->gradeLevel->grade }} – {{ mb_strtoupper($section->name) }}</div>
        <div>Class Adviser: <span class="adviser">{{ $adviser ?? '' }}</span></div>
    </div>

    @php($rowCount = collect($blocks)->max(fn ($block) => count($block['rows'])) ?? 0)

    <table class="program">
        <thead>
            <tr>
                @foreach ($blocks as $block)
                    @if (! $loop->first)
                        <th class="spacer"></th>
                    @endif
                    <th>TIME</th>
                    <th>No. of Mins.</th>
                    <th>{{ mb_strtoupper($block['name']) }}</th>
                    <th>TEACHER</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @for ($index = 0; $index < $rowCount; $index++)
                <tr>
                    @foreach ($blocks as $block)
                        @php($row = $block['rows'][$index] ?? null)
                        @if (! $loop->first)
                            <td class="spacer"></td>
                        @endif
                        @if ($row === null)
                            <td></td><td></td><td></td><td></td>
                        @elseif ($row['is_break'])
                            <td class="time break">{{ $row['time'] }}</td>
                            <td class="minutes break">{{ $row['minutes'] }}</td>
                            <td class="break" colspan="2">{{ $row['subject'] }}</td>
                        @else
                            <td class="time">{{ $row['time'] }}</td>
                            <td class="minutes">{{ $row['minutes'] }}</td>
                            <td>{{ $row['subject'] }}</td>
                            <td>{{ $row['teacher'] }}</td>
                        @endif
                    @endforeach
                </tr>
            @endfor
        </tbody>
    </table>

    <table class="totals">
        @foreach ($blocks as $block)
            <tr>
                <td width="24%">{{ $block['name'] }}</td>
                <td>
                    Total per day: <strong>{{ $block['total_minutes'] }} minutes</strong> ({{ $block['duration'] }}),
                    of which {{ $block['class_minutes'] }} minutes are class time
                </td>
            </tr>
        @endforeach
        @if ($settings?->reference_note)
            <tr>
                <td colspan="2" class="note">{{ $settings->reference_note }}</td>
            </tr>
        @endif
    </table>

    @include('reports.partials.signatures')

    @include('reports.partials.footer')
</body>
</html>
