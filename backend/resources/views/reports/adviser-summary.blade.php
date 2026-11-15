<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    @include('reports.partials.styles')
    <style>
        table.pair { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10pt; page-break-inside: avoid; }
        table.pair > tbody > tr > td.side { width: 49%; vertical-align: top; padding: 0; }
        table.pair > tbody > tr > td.gap { width: 2%; }
        table.advisers { width: 100%; border-collapse: collapse; }
        table.advisers th, table.advisers td { border: 0.6pt solid #000; padding: 3pt 4pt; font-size: 8pt; text-align: left; vertical-align: top; }
        table.advisers th { background: #d0d0d0; }
        table.advisers th.grade { background: #790D16; color: #fff; text-align: center; font-size: 9pt; letter-spacing: 0.5pt; }
        table.advisers td.number, table.advisers th.number { width: 16pt; text-align: center; }
        table.advisers td.room { width: 58pt; }
    </style>
</head>
<body>
    @include('reports.partials.header')

    <div class="title">
        <div>{{ $title }}</div>
        <div>{{ $term_label }}</div>
    </div>

    @forelse (array_chunk($grades, 2) as $pair)
        <table class="pair">
            <tbody>
                <tr>
                    @foreach ($pair as $index => $grade)
                        @if ($index === 1)
                            <td class="gap"></td>
                        @endif
                        <td class="side">
                            <table class="advisers">
                                <thead>
                                    <tr><th class="grade" colspan="5">{{ $grade['title'] }}</th></tr>
                                    <tr>
                                        <th class="number">#</th>
                                        <th>Section</th>
                                        <th>Room Assignment</th>
                                        <th>Adviser</th>
                                        <th>Co-Adviser</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($grade['sections'] as $section)
                                        <tr>
                                            <td class="number">{{ $section['number'] }}</td>
                                            <td>{{ $section['name'] }}</td>
                                            <td class="room">{{ $section['room'] ?? '–' }}</td>
                                            <td>{{ $section['adviser'] ?? '–' }}</td>
                                            <td>{{ $section['co_adviser'] ?? '' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </td>
                    @endforeach
                    @if (count($pair) === 1)
                        <td class="gap"></td>
                        <td class="side"></td>
                    @endif
                </tr>
            </tbody>
        </table>
    @empty
        <p>No section has been encoded for this school year yet.</p>
    @endforelse

    @php
        $settings = null;
    @endphp
    @include('reports.partials.footer')
</body>
</html>
