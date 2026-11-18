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
        <div>{{ $term_label }}</div>
        <div>{{ $heading }}</div>
    </div>
    @if ($details !== [])
        <div class="details">{{ implode(' · ', $details) }}</div>
    @endif

    <table class="grid">
        <thead>
            <tr>
                <th width="16%">TIME</th>
                <th width="6%">No. of Mins.</th>
                @foreach ($days as $day)
                    <th>{{ mb_strtoupper($day['name']) }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td>{{ $row['time'] }}</td>
                    <td>{{ $row['minutes'] }}</td>
                    @foreach ($days as $day)
                        <td>
                            @foreach ($row['cells'][$day['day']] as $lines)
                                @foreach (array_values(array_filter($lines)) as $index => $line)
                                    <span class="class-line {{ $index === 0 ? 'class-section' : '' }}">{{ $line }}</span>
                                @endforeach
                            @endforeach
                        </td>
                    @endforeach
                </tr>
            @endforeach
            <tr>
                <td class="total" colspan="2">Total minutes</td>
                @foreach ($days as $day)
                    <td class="total">{{ $totals['per_day'][$day['day']] }}</td>
                @endforeach
            </tr>
        </tbody>
    </table>

    <div class="week-total">
        Total per week: <strong>{{ $totals['week'] }} minutes</strong> ({{ $totals['week_duration'] }})
        @if ($settings?->reference_note)
            <div class="note">{{ $settings->reference_note }}</div>
        @endif
    </div>

    @include('reports.partials.signatures')

    @include('reports.partials.footer')
</body>
</html>
