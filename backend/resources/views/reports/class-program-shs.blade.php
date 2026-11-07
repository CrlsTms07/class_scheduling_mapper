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
        <div>{{ mb_strtoupper($section->name) }}</div>
        <div>Class Adviser: <span class="adviser">{{ $adviser ?? '' }}</span></div>
    </div>

    <table class="grid">
        <thead>
            <tr>
                <th width="13%">TIME</th>
                <th width="7%">NO. OF MINUTES</th>
                @foreach ($weekly['days'] as $day)
                    <th>{{ mb_strtoupper($day['name']) }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($weekly['rows'] as $row)
                <tr>
                    <td>{{ $row['time'] }}</td>
                    <td>{{ $row['minutes'] }}</td>
                    @if ($row['wide_break'] !== null)
                        <td class="break" colspan="5">{{ $row['wide_break'] }}</td>
                    @else
                        @foreach ($weekly['days'] as $day)
                            @if (isset($row['breaks'][$day['day']]))
                                <td class="break">{{ $row['breaks'][$day['day']] }}</td>
                            @else
                                <td>
                                    @if ($row['cells'][$day['day']])
                                        <span class="class-line class-section">{{ $row['cells'][$day['day']]['subject'] }}</span>
                                        <span class="class-line">{{ $row['cells'][$day['day']]['teacher'] }}</span>
                                        <span class="class-line">{{ $row['cells'][$day['day']]['room'] }}</span>
                                    @endif
                                </td>
                            @endif
                        @endforeach
                    @endif
                </tr>
            @endforeach
            <tr>
                <td class="total" colspan="2">Total Time Duration</td>
                @foreach ($weekly['days'] as $day)
                    <td class="total">{{ $weekly['totals'][$day['day']] }}</td>
                @endforeach
            </tr>
        </tbody>
    </table>

    @if ($settings?->reference_note)
        <div class="week-total note">{{ $settings->reference_note }}</div>
    @endif

    @include('reports.partials.signatures')

    @include('reports.partials.footer')
</body>
</html>
